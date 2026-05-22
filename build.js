const fs = require('fs');
const path = require('path');

const files = ['auth.html', 'chat.html', 'onboarding.html', 'index.html', 'profile.html', 'history.html', 'verified.html'];

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('ERROR: SUPABASE_URL and SUPABASE_ANON_KEY must be set.');
    process.exit(1);
}

files.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');
        // Replace the placeholder strings (without quotes)
        content = content.replace(/__SUPABASE_URL__/g, supabaseUrl);
        content = content.replace(/__SUPABASE_ANON_KEY__/g, supabaseAnonKey);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`✅ Replaced placeholders in ${file}`);
    } else {
        console.warn(`⚠️ File not found, skipped: ${file}`);
    }
});