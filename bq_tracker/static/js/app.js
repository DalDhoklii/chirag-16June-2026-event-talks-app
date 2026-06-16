// BigQuery Release Radar client-side logic

document.addEventListener('DOMContentLoaded', () => {
    // App State
    let allNotes = [];
    let filteredNotes = [];
    let currentFilter = 'all';
    let searchQuery = '';
    
    // DOM Elements
    const notesFeed = document.getElementById('notesFeed');
    const searchInput = document.getElementById('searchInput');
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const btnText = document.getElementById('btnText');
    const spinnerIcon = document.getElementById('spinnerIcon');
    const lastUpdated = document.getElementById('lastUpdated');
    
    // Stats elements
    const countAll = document.getElementById('countAll');
    const countFeatures = document.getElementById('countFeatures');
    const countBreaking = document.getElementById('countBreaking');
    
    // Filter Pills
    const filterPills = document.querySelectorAll('.filter-pill');
    const feedStatusText = document.getElementById('feedStatusText');
    const resultCount = document.getElementById('resultCount');
    const emptyState = document.getElementById('emptyState');
    const resetFiltersBtn = document.getElementById('resetFiltersBtn');
    
    // Modal Elements
    const tweetModal = document.getElementById('tweetModal');
    const tweetTextarea = document.getElementById('tweetTextarea');
    const closeModalBtn = document.getElementById('closeModalBtn');
    const cancelTweetBtn = document.getElementById('cancelTweetBtn');
    const postTweetBtn = document.getElementById('postTweetBtn');
    const charCounter = document.getElementById('charCounter');
    const countCircle = document.getElementById('countCircle');
    const hashtagPills = document.querySelectorAll('.hashtag-pill');
    
    // Toast Container
    const toastContainer = document.getElementById('toastContainer');

    // --- Core API Calls ---
    
    // Fetch release notes
    async function fetchNotes(bypassCache = false) {
        setLoadingState(true);
        try {
            const url = bypassCache ? '/api/notes?refresh=true' : '/api/notes';
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error('Server returned an error status.');
            }
            
            const data = await response.json();
            if (data.success) {
                allNotes = data.notes;
                
                // Update last updated timestamp
                const now = new Date();
                lastUpdated.textContent = `Last synced: ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
                
                updateStats();
                applyFiltersAndSearch();
                
                if (bypassCache) {
                    showToast('Feed successfully refreshed with latest Google BQ updates!', 'success');
                }
            } else {
                throw new Error(data.error || 'Failed to fetch notes');
            }
        } catch (error) {
            console.error('Error fetching release notes:', error);
            showToast(`Sync Failed: ${error.message || 'Unable to contact server'}`, 'error');
            
            // If we have no notes showing but the request failed, show empty state
            if (allNotes.length === 0) {
                notesFeed.innerHTML = '';
                emptyState.style.display = 'flex';
            }
        } finally {
            setLoadingState(false);
        }
    }

    // Toggle Loading UI State
    function setLoadingState(isLoading) {
        if (isLoading) {
            // Disable refresh button and spin icon
            refreshBtn.disabled = true;
            spinnerIcon.classList.add('spinning');
            btnText.textContent = 'Syncing...';
            
            // If empty or first load, show skeletons
            if (allNotes.length === 0) {
                notesFeed.innerHTML = `
                    <div class="skeleton-card">
                        <div class="skeleton-header">
                            <div class="skeleton-line short"></div>
                            <div class="skeleton-line badge"></div>
                        </div>
                        <div class="skeleton-body">
                            <div class="skeleton-line long"></div>
                            <div class="skeleton-line medium"></div>
                            <div class="skeleton-line short"></div>
                        </div>
                    </div>
                    <div class="skeleton-card">
                        <div class="skeleton-header">
                            <div class="skeleton-line short"></div>
                            <div class="skeleton-line badge"></div>
                        </div>
                        <div class="skeleton-body">
                            <div class="skeleton-line long"></div>
                            <div class="skeleton-line medium"></div>
                        </div>
                    </div>
                `;
                emptyState.style.display = 'none';
            }
        } else {
            refreshBtn.disabled = false;
            spinnerIcon.classList.remove('spinning');
            btnText.textContent = 'Refresh Feed';
        }
    }

    // --- Stats & Filtering logic ---
    
    // Calculate stats
    function updateStats() {
        countAll.textContent = allNotes.length;
        
        const features = allNotes.filter(n => n.type.toLowerCase() === 'feature').length;
        countFeatures.textContent = features;
        
        const breakingAndIssues = allNotes.filter(n => {
            const type = n.type.toLowerCase();
            return type === 'breaking' || type === 'issue';
        }).length;
        countBreaking.textContent = breakingAndIssues;
    }

    // Apply Filter & Search query to state
    function applyFiltersAndSearch() {
        filteredNotes = allNotes.filter(note => {
            // 1. Filter by category
            const typeLower = note.type.toLowerCase();
            if (currentFilter !== 'all') {
                if (currentFilter === 'feature' && typeLower !== 'feature') return false;
                if (currentFilter === 'issue' && typeLower !== 'issue') return false;
                if (currentFilter === 'change' && typeLower !== 'change') return false;
                if (currentFilter === 'breaking' && typeLower !== 'breaking') return false;
                if (currentFilter === 'announcement' && typeLower !== 'announcement') return false;
            }
            
            // 2. Filter by search query
            if (searchQuery.trim() !== '') {
                const query = searchQuery.toLowerCase();
                const titleMatch = note.date.toLowerCase().includes(query);
                const typeMatch = note.type.toLowerCase().includes(query);
                const contentMatch = note.content_text.toLowerCase().includes(query);
                return titleMatch || typeMatch || contentMatch;
            }
            
            return true;
        });

        renderNotes();
    }

    // Render notes timeline
    function renderNotes() {
        notesFeed.innerHTML = '';
        
        // Update Filter Labels
        let label = 'all updates';
        if (currentFilter !== 'all') {
            label = currentFilter + 's';
        }
        
        if (searchQuery) {
            feedStatusText.textContent = `Search results for "${searchQuery}" in ${label}`;
        } else {
            feedStatusText.textContent = `Showing ${label}`;
        }
        
        resultCount.textContent = `${filteredNotes.length} found`;

        if (filteredNotes.length === 0) {
            emptyState.style.display = 'flex';
            return;
        }
        
        emptyState.style.display = 'none';

        // Fragment for high performance DOM updates
        const fragment = document.createDocumentFragment();

        filteredNotes.forEach(note => {
            const card = document.createElement('article');
            card.className = `note-card note-${note.type.toLowerCase()}`;
            card.id = note.id;

            // Classify header badge color class
            const badgeClass = `badge-${note.type.toLowerCase()}`;

            card.innerHTML = `
                <div class="note-header">
                    <span class="note-date">${note.date}</span>
                    <span class="note-badge ${badgeClass}">${note.type}</span>
                </div>
                <div class="note-body">
                    ${note.content_html}
                </div>
                <div class="note-footer">
                    <button class="action-btn copy-text-btn" title="Copy update text to clipboard">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                        </svg>
                        Copy Text
                    </button>
                    <a href="${note.link}" target="_blank" class="action-btn copy-link-btn" title="Open official release notes site">
                        <svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                            <polyline points="15 3 21 3 21 9"></polyline>
                            <line x1="10" y1="14" x2="21" y2="3"></line>
                        </svg>
                        Source
                    </a>
                    <button class="action-btn action-btn-share share-tweet-btn" title="Draft post to share on X / Twitter">
                        <svg class="icon" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                        </svg>
                        Share on X
                    </button>
                </div>
            `;

            // Attach event listeners to card action buttons
            card.querySelector('.copy-text-btn').addEventListener('click', () => {
                copyToClipboard(note.content_text, 'Update text copied to clipboard!');
            });

            card.querySelector('.share-tweet-btn').addEventListener('click', () => {
                openTweetModal(note);
            });

            fragment.appendChild(card);
        });

        notesFeed.appendChild(fragment);
    }

    // --- Tweet composer Modal Logic ---
    
    // Generate draft tweet text based on note data and category
    function generateTweetDraft(note) {
        let prefix = '📢 BigQuery Update';
        const type = note.type.toLowerCase();
        
        if (type === 'feature') prefix = '🚀 New BigQuery Feature';
        else if (type === 'issue') prefix = '⚠️ BigQuery Issue';
        else if (type === 'breaking') prefix = '🚨 BigQuery Breaking Change';
        else if (type === 'change') prefix = '⚙️ BigQuery Change';
        else if (type === 'announcement') prefix = '📣 BigQuery Announcement';
        
        const dateStr = note.date;
        const text = note.content_text;
        
        // Hashtag footer length space
        const defaultHashtags = '\n\n#BigQuery #GoogleCloud';
        
        // Calculate max description length to stay under 280 characters:
        // 280 - (prefix + date length + hashtags + punctuation + newlines)
        const envelopeLen = prefix.length + dateStr.length + defaultHashtags.length + 8;
        const maxDescLen = 280 - envelopeLen;
        
        let desc = text;
        if (text.length > maxDescLen) {
            desc = text.substring(0, maxDescLen - 3) + '...';
        }
        
        return `${prefix} (${dateStr}):\n\n${desc}${defaultHashtags}`;
    }

    // Open Modal and initialize values
    function openTweetModal(note) {
        const draftText = generateTweetDraft(note);
        tweetTextarea.value = draftText;
        
        // Set aria-hidden to false for accessibility
        tweetModal.setAttribute('aria-hidden', 'false');
        tweetModal.classList.add('active');
        
        // Sync active states on hashtag pills based on text contents
        updateHashtagPillStates();
        updateCharCount();
        
        // Focus on textarea
        tweetTextarea.focus();
        // Set cursor to start or end
        tweetTextarea.setSelectionRange(draftText.length, draftText.length);
    }

    // Close Modal
    function closeTweetModal() {
        tweetModal.setAttribute('aria-hidden', 'true');
        tweetModal.classList.remove('active');
    }

    // Update character counter and SVG progress circle
    function updateCharCount() {
        const len = tweetTextarea.value.length;
        const charsLeft = 280 - len;
        
        charCounter.textContent = charsLeft;
        
        // Circle progress calculation (stroke-dasharray perimeter is exactly 100)
        const percentage = Math.min((len / 280) * 100, 100);
        countCircle.setAttribute('stroke-dasharray', `${percentage}, 100`);
        
        // Adjust styling classes based on length limits
        charCounter.className = 'char-counter';
        countCircle.className.baseVal = 'circle-val';
        
        if (charsLeft < 0) {
            charCounter.classList.add('danger');
            countCircle.classList.add('danger');
            postTweetBtn.disabled = true;
        } else if (charsLeft <= 25) {
            charCounter.classList.add('warning');
            countCircle.classList.add('warning');
            postTweetBtn.disabled = false;
        } else {
            postTweetBtn.disabled = false;
        }
        
        updateHashtagPillStates();
    }

    // Match helper hashtag pill highlight to actual textarea contents
    function updateHashtagPillStates() {
        const text = tweetTextarea.value.toLowerCase();
        hashtagPills.forEach(pill => {
            const tag = pill.getAttribute('data-tag').toLowerCase();
            if (text.includes(tag)) {
                pill.classList.add('active');
            } else {
                pill.classList.remove('active');
            }
        });
    }

    // Toggle hashtag inside composer
    function toggleHashtag(tag) {
        let text = tweetTextarea.value;
        const tagRegex = new RegExp(`\\s*${tag}\\b`, 'gi');
        
        if (text.toLowerCase().includes(tag.toLowerCase())) {
            // Remove hashtag if present
            text = text.replace(tagRegex, '').trim();
        } else {
            // Add hashtag at the end
            text = text.trim() + ' ' + tag;
        }
        
        tweetTextarea.value = text;
        updateCharCount();
        tweetTextarea.focus();
    }

    // --- Toast Alerts & Clipboard helpers ---
    
    // Copy string helper
    function copyToClipboard(text, successMsg) {
        if (!navigator.clipboard) {
            // Fallback for older browsers
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed'; // Avoid page scrolling
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                showToast(successMsg, 'success');
            } catch (err) {
                console.error('Fallback copy failed', err);
                showToast('Failed to copy text', 'error');
            }
            document.body.removeChild(textarea);
            return;
        }
        
        navigator.clipboard.writeText(text)
            .then(() => {
                showToast(successMsg, 'success');
            })
            .catch(err => {
                console.error('Clipboard copy failed:', err);
                showToast('Failed to copy text to clipboard', 'error');
            });
    }

    // Pop toast notice
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast`;
        
        // Add svg icon inside toast
        const iconSvg = type === 'success' 
            ? `<svg class="toast-success-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`
            : `<svg class="toast-success-icon" style="color:var(--color-breaking)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>`;
            
        toast.innerHTML = `${iconSvg} <span>${message}</span>`;
        
        toastContainer.appendChild(toast);
        
        // Trigger reflow to start transition
        setTimeout(() => {
            toast.classList.add('show');
        }, 50);
        
        // Remove toast after delay
        setTimeout(() => {
            toast.classList.remove('show');
            // Wait for transition to complete before deleting
            setTimeout(() => {
                if (toastContainer.contains(toast)) {
                    toastContainer.removeChild(toast);
                }
            }, 300);
        }, 3000);
    }

    // --- Interactive Event Listeners ---
    
    // Search input typing handler
    let searchDebounceTimer;
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        
        // Toggle Clear search button visibility
        if (searchQuery.length > 0) {
            clearSearchBtn.style.display = 'block';
        } else {
            clearSearchBtn.style.display = 'none';
        }
        
        // Debounce search render to keep UI extremely responsive
        clearTimeout(searchDebounceTimer);
        searchDebounceTimer = setTimeout(() => {
            applyFiltersAndSearch();
        }, 150);
    });

    // Clear search keyword button click
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        applyFiltersAndSearch();
        searchInput.focus();
    });

    // Category filter pills click
    filterPills.forEach(pill => {
        pill.addEventListener('click', () => {
            // Switch active classes
            filterPills.forEach(p => p.classList.remove('active'));
            pill.classList.add('active');
            
            // Set state and render
            currentFilter = pill.getAttribute('data-type');
            applyFiltersAndSearch();
        });
    });

    // Reset all filters button in empty states
    resetFiltersBtn.addEventListener('click', () => {
        // Clear Search
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        
        // Set Filter to All
        filterPills.forEach(p => p.classList.remove('active'));
        document.querySelector('.filter-pill[data-type="all"]').classList.add('active');
        currentFilter = 'all';
        
        applyFiltersAndSearch();
    });

    // Refresh Feed Button
    refreshBtn.addEventListener('click', () => {
        fetchNotes(true);
    });

    // Modal close listeners
    closeModalBtn.addEventListener('click', closeTweetModal);
    cancelTweetBtn.addEventListener('click', closeTweetModal);
    
    // Clicking outside modal container closes it
    tweetModal.addEventListener('click', (e) => {
        if (e.target === tweetModal) {
            closeTweetModal();
        }
    });

    // Composer Keyup typing
    tweetTextarea.addEventListener('input', updateCharCount);

    // Hashtag helper pill click
    hashtagPills.forEach(pill => {
        pill.addEventListener('click', () => {
            const tag = pill.getAttribute('data-tag');
            toggleHashtag(tag);
        });
    });

    // Post on X (Twitter Intent url open)
    postTweetBtn.addEventListener('click', () => {
        const text = tweetTextarea.value;
        const encodedText = encodeURIComponent(text);
        const twitterUrl = `https://twitter.com/intent/tweet?text=${encodedText}`;
        
        // Open intent
        window.open(twitterUrl, '_blank', 'width=550,height=420,toolbar=no,menubar=no,scrollbars=yes');
        
        // Close compose modal
        closeTweetModal();
        showToast('Redirected to X post composer!', 'success');
    });

    // Keyboard ESC closes modal
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && tweetModal.classList.contains('active')) {
            closeTweetModal();
        }
    });

    // Initialize: Fetch data on load
    fetchNotes(false);
});
