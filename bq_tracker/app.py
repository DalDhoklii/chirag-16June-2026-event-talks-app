import os
import re
import html
import logging
from datetime import datetime
import xml.etree.ElementTree as ET
import requests
from flask import Flask, render_template, jsonify, request

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)

FEED_URL = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
CACHE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "notes_cache.json")

# Helper: Strip HTML tags to get plain text
def strip_html(html_str):
    # Replace line break tags with newlines
    text = html_str
    text = re.sub(r'<br\s*/?>', '\n', text)
    text = re.sub(r'</p>', '\n\n', text)
    text = re.sub(r'</li>', '\n', text)
    # Strip all other HTML tags
    text = re.sub(r'<[^>]+>', '', text)
    # Decode HTML entities (like &amp;, &lt;, &gt;, &quot;, &#39;)
    text = html.unescape(text)
    # Clean up whitespace
    text = re.sub(r' +', ' ', text)
    text = re.sub(r'\n{3,}', '\n\n', text)
    return text.strip()

# Helper: Parse XML entry content and split into items
def parse_entry_content(entry_title, content_html, alternate_link, entry_id_base):
    # The content is HTML containing <h3>Tags</h3> and description paragraphs/lists
    # We split using <h3> tags as boundary markers
    parts = re.split(r'(<h3>.*?</h3>)', content_html)
    
    items = []
    current_type = "Update"  # Fallback type
    
    # We iterate over the split parts. The first part is usually empty or preceding text.
    # Subsequent parts alternate between the <h3> tag and the HTML that follows it.
    i = 0
    while i < len(parts):
        part = parts[i].strip()
        if not part:
            i += 1
            continue
            
        # Check if this part is a header tag
        header_match = re.match(r'<h3>(.*?)</h3>', part, re.IGNORECASE)
        if header_match:
            current_type = header_match.group(1).strip()
            # The next part should be the content of this section
            if i + 1 < len(parts):
                desc_html = parts[i+1].strip()
                desc_text = strip_html(desc_html)
                
                # Create a unique identifier for this sub-item
                item_index = len(items)
                item_id = f"{entry_id_base}_{item_index}"
                
                items.append({
                    "id": item_id,
                    "date": entry_title,
                    "type": current_type,
                    "content_html": desc_html,
                    "content_text": desc_text,
                    "link": alternate_link
                })
                i += 2
            else:
                i += 1
        else:
            # If there's content without a preceding h3, we capture it under "Update"
            desc_html = part
            desc_text = strip_html(desc_html)
            item_id = f"{entry_id_base}_{len(items)}"
            items.append({
                "id": item_id,
                "date": entry_title,
                "type": "Update",
                "content_html": desc_html,
                "content_text": desc_text,
                "link": alternate_link
            })
            i += 1
            
    return items

def fetch_and_parse_feed():
    try:
        logger.info(f"Fetching XML feed from {FEED_URL}...")
        response = requests.get(FEED_URL, timeout=15)
        response.raise_for_status()
        
        # Parse Atom Feed XML
        root = ET.fromstring(response.content)
        
        # Define namespace for Atom
        namespace = {'atom': 'http://www.w3.org/2005/Atom'}
        
        all_notes = []
        
        # Iterate over all <entry> tags
        for entry in root.findall('atom:entry', namespace):
            title_el = entry.find('atom:title', namespace)
            title = title_el.text.strip() if title_el is not None else ""
            
            # Format standard date for sorting if possible
            date_sort_str = ""
            try:
                # E.g. "June 15, 2026"
                dt = datetime.strptime(title, "%B %d, %Y")
                date_sort_str = dt.strftime("%Y-%m-%d")
            except ValueError:
                # Fallback to parsing updated date
                updated_el = entry.find('atom:updated', namespace)
                if updated_el is not None and updated_el.text:
                    date_sort_str = updated_el.text[:10]
            
            updated_el = entry.find('atom:updated', namespace)
            updated_time = updated_el.text.strip() if updated_el is not None else ""
            
            link_el = entry.find("atom:link[@rel='alternate']", namespace)
            if link_el is None:
                link_el = entry.find("atom:link", namespace)
            link = link_el.attrib.get('href', '') if link_el is not None else ''
            
            id_el = entry.find('atom:id', namespace)
            entry_id = id_el.text.strip() if id_el is not None else ""
            # Create a safe base ID for splitting items
            entry_id_base = re.sub(r'[^a-zA-Z0-9]', '_', entry_id.split('#')[-1] if '#' in entry_id else entry_id)
            
            content_el = entry.find('atom:content', namespace)
            if content_el is not None and content_el.text:
                html_content = content_el.text
                items = parse_entry_content(title, html_content, link, entry_id_base)
                
                # Add sorting metadata to each item
                for item in items:
                    item["sort_date"] = date_sort_str or "0000-00-00"
                    all_notes.append(item)
                    
        # Sort notes by date descending
        all_notes.sort(key=lambda x: x.get("sort_date", ""), reverse=True)
        
        # Save cache
        import json
        with open(CACHE_FILE, 'w') as f:
            json.dump(all_notes, f, indent=2)
            
        return all_notes, None
        
    except Exception as e:
        logger.error(f"Error fetching/parsing feed: {str(e)}")
        return None, str(e)

def get_notes(force_refresh=False):
    notes = None
    error = None
    
    # Check if cache exists and is not force_refreshed
    if not force_refresh and os.path.exists(CACHE_FILE):
        try:
            import json
            with open(CACHE_FILE, 'r') as f:
                notes = json.load(f)
            logger.info("Loaded notes from local JSON cache.")
        except Exception as e:
            logger.warning(f"Failed to read cache file: {str(e)}")
            
    # Fetch if no notes in cache or force_refresh is requested
    if notes is None:
        notes, error = fetch_and_parse_feed()
        
    return notes, error

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/notes")
def api_notes():
    force_refresh = request.args.get("refresh", "false").lower() == "true"
    notes, error = get_notes(force_refresh=force_refresh)
    
    if error:
        return jsonify({
            "success": False,
            "error": error
        }), 500
        
    return jsonify({
        "success": True,
        "notes": notes,
        "count": len(notes)
    })

if __name__ == "__main__":
    app.run(debug=True, port=5001)
