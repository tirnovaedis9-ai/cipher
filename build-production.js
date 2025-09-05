#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Production build script for frontend JavaScript files
console.log('🔧 Building production version of frontend files...');

const jsFiles = [
    'public/js/auth.js',
    'public/js/chat.js', 
    'public/js/game.js',
    'public/js/leaderboard.js',
    'public/js/profile.js',
    'public/js/main.js',
    'public/js/ui.js'
];

jsFiles.forEach(filePath => {
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        
        // Replace process.env.NODE_ENV !== 'production' with false for production
        content = content.replace(/process\.env\.NODE_ENV !== 'production'/g, 'false');
        
        // Write the production version
        fs.writeFileSync(filePath, content);
        console.log(`✅ Processed: ${filePath}`);
    } else {
        console.log(`⚠️ File not found: ${filePath}`);
    }
});

console.log('🎉 Production build completed!');
console.log('📝 All console.log statements are now disabled for production.');

