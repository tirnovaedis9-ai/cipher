let translations = {};

async function fetchTranslations(lang) {
    try {
        const response = await fetch(`/locales/${lang}.json`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        translations = await response.json();
        applyTranslations();
    } catch (error) {
        console.error('Error fetching translations:', error);
    }
}

function applyTranslations() {
    document.querySelectorAll('[data-i18n]').forEach(element => {
        const key = element.getAttribute('data-i18n');
        if (translations[key]) {
            const textNode = Array.from(element.childNodes).find(node => 
                node.nodeType === Node.TEXT_NODE && node.textContent.trim().length > 0
            );
            if (textNode) {
                const leadingSpace = textNode.textContent.startsWith(' ') ? ' ' : '';
                const trailingSpace = textNode.textContent.endsWith(' ') ? ' ' : '';
                textNode.textContent = leadingSpace + translations[key] + trailingSpace;
            } else if (element.children.length > 0 && element.hasAttribute('data-i18n-target')) {
                const targetElement = element.querySelector(element.getAttribute('data-i18n-target'));
                if(targetElement) targetElement.textContent = translations[key];
            }
            else {
                element.textContent = translations[key];
            }
        }
    });

    document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
        const key = element.getAttribute('data-i18n-placeholder');
        if (translations[key]) {
            element.placeholder = translations[key];
        }
    });

    document.querySelectorAll('[data-i18n-title]').forEach(element => {
        const key = element.getAttribute('data-i18n-title');
        if (translations[key]) {
            element.title = translations[key];
        }
    });

    // NEW: Handle data-i18n-label attribute for responsive table labels
    document.querySelectorAll('[data-i18n-label]').forEach(element => {
        const key = element.getAttribute('data-i18n-label');
        if (translations[key]) {
            element.setAttribute('data-label', translations[key]);
        }
    });
}

function getTranslation(key, ...args) {
    let translation = translations[key] || key;
    if (args.length > 0) {
        args.forEach((arg, index) => {
            translation = translation.replace(`{${index}}`, arg);
        });
    }
    return translation;
}

function initializeLanguageSwitcher() {
    const languageButtons = {
        mobile: document.getElementById('mobileLanguageBtn')
    };
    const languageDropdowns = {
        mobile: document.getElementById('mobileLanguageDropdown')
    };
    const currentFlags = {
        mobile: document.getElementById('mobileCurrentFlag')
    };

    const setupSwitcher = (type) => {
        const btn = languageButtons[type];
        const dropdown = languageDropdowns[type];
        if (!btn || !dropdown) return;

        btn.addEventListener('click', (event) => {
            event.stopPropagation();
            dropdown.classList.toggle('show');
        });

        document.addEventListener('click', (event) => {
            if (!dropdown.contains(event.target) && !btn.contains(event.target)) {
                dropdown.classList.remove('show');
            }
        });

        dropdown.querySelectorAll('.language-option').forEach(option => {
            option.addEventListener('click', async (event) => {
                event.preventDefault();
                const newLang = option.getAttribute('data-lang');
                const currentLang = localStorage.getItem('selectedLanguage') || 'en';

                if (newLang !== currentLang) {
                    localStorage.setItem('selectedLanguage', newLang);
                    document.documentElement.lang = newLang;
                    await fetchTranslations(newLang);
                    updateFlag(newLang);

                    // Dispatch a custom event to notify other parts of the app
                    document.dispatchEvent(new CustomEvent('languageChanged'));
                }
                
                dropdown.classList.remove('show');
            });
        });
    };

    setupSwitcher('mobile');

    const savedLanguage = localStorage.getItem('selectedLanguage') || 'en';
    updateFlag(savedLanguage);
}

async function initializeLanguage() {
    let selectedLanguage = localStorage.getItem('selectedLanguage');

    if (!selectedLanguage) {
        const browserLang = navigator.language.split('-')[0];
        const supportedLanguages = ['en', 'tr', 'de', 'ko', 'ar', 'es', 'fr', 'it', 'ja', 'ru', 'zh']; 
        if (supportedLanguages.includes(browserLang)) {
            selectedLanguage = browserLang;
        } else {
            selectedLanguage = 'en';
        }
        localStorage.setItem('selectedLanguage', selectedLanguage);
    }

    document.documentElement.lang = selectedLanguage;
    
    await fetchTranslations(selectedLanguage);
    updateFlag(selectedLanguage);
}

function updateFlag(lang) {
    const currentFlags = {
        mobile: document.getElementById('mobileCurrentFlag')
    };
    const option = document.querySelector(`.language-option[data-lang='${lang}']`);
    if (option) {
        const flagSrc = option.querySelector('img').src;
        const flagAlt = option.querySelector('img').alt;
        if (currentFlags.mobile) {
            currentFlags.mobile.src = flagSrc;
            currentFlags.mobile.alt = flagAlt;
        }
    }
}


document.addEventListener('DOMContentLoaded', () => {
    initializeLanguageSwitcher();
    initializeLanguage().then(() => {
        if (typeof updateProfileDisplay === 'function') {
            updateProfileDisplay(gameState.level);
        }
        if (typeof initializeLeaderboardPreviews === 'function') {
            initializeLeaderboardPreviews();
        }
    });
});

window.getTranslation = getTranslation;
window.fetchTranslations = fetchTranslations;
window.applyTranslations = applyTranslations;
window.initializeLanguage = initializeLanguage;