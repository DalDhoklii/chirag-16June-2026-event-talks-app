# BigQuery Release Radar 🚀

BigQuery Release Radar is a modern, premium web application built using Python Flask, plain HTML, CSS, and JavaScript. It fetches the official Google BigQuery Release Notes RSS feed, parses it dynamically, groups the updates into distinct types (Features, Issues, Changes, Announcements, Breaking), and allows you to copy or instantly tweet any specific update with a custom tweet composer.

## Features

- **Automatic Live Parsing:** Fetches and parses the Google Cloud BigQuery XML feed directly. 
- **Granular Updates Timeline:** Splits combined daily release logs into individual update cards, sorted chronologically.
- **Visual Glow Badges:** Color-coded status badges for Features (Green), Issues (Amber), Changes (Purple), Breaking (Red), and Announcements (Blue).
- **Interactive Search & Filtering:** Client-side live search and category buttons with dynamic rendering.
- **Local Cache:** Caches fetched updates locally in `notes_cache.json` to load instantly, while supporting manual fetch requests.
- **Manual Sync Button:** A glowing refresh button with a smooth SVG spinner to pull the latest feed data asynchronously.
- **Custom X (Twitter) Composer:** Click "Share on X" on any release note to open a custom draft card with pre-formatted text (under X's 280-char limit), live character counter with a circular progress meter, quick-toggle hashtag pills, and integration with the X Web Sharing Intent.
- **Toast Notifications:** A stylish bottom-right notification toast to show operation status (success copy, sync complete, etc.).

## Project Structure

```text
bq_tracker/
│
├── app.py                # Flask Backend (Feed fetching, XML Atom parsing, JSON cache, API)
├── notes_cache.json      # Local parsed data cache (auto-generated)
├── README.md             # Project documentation (this file)
│
├── templates/
│   └── index.html        # Main HTML layout and structural markup
│
└── static/
    ├── css/
    │   └── style.css     # CSS Variables, dark theme, glassmorphism, animations, skeletons
    └── js/
        └── app.js        # JavaScript event handlers, search/filter debouncing, tweet composer
```

## Setup & Running

### 1. Install Dependencies
Make sure you have `Flask` and `requests` installed:
```bash
pip install flask requests
```

### 2. Start the Server
Navigate to the workspace or run directly:
```bash
python3 bq_tracker/app.py
```
The server will start on: **`http://127.0.0.1:5001`**

### 3. Open in Browser
Open your browser and navigate to `http://127.0.0.1:5001` to view the application.

## Development Details

- **Backend Logic:** Uses python standard `xml.etree.ElementTree` for parsing the Atom XML and regex boundaries to split `<h3>` HTML headers.
- **Frontend Styling:** Done in vanilla CSS for flexible styling. Implements glassmorphism (`backdrop-filter`), CSS variables, custom layouts, ambient blurred backdrops, and hover scale transitions.
- **Frontend Interaction:** Done in vanilla JavaScript. Connects to the Flask `/api/notes` API for fetching notes, debounces search keystrokes, manages clipboard operations, and controls modal transitions.
