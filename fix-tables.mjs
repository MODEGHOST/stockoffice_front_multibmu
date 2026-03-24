import fs from 'fs';
import path from 'path';

function processDir(dir) {
  const files = fs.readdirSync(dir);
  for (const file of files) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      processDir(fullPath);
    } else if (fullPath.endsWith('.tsx') || fullPath.endsWith('.jsx')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      
      // Check if file has a Table but doesn't have a scroll prop defined
      if (content.includes('<Table') && !content.includes('scroll={{')) {
        // Match <Table followed by whitespace, newline or >. Exclude <Table.
        const regex = /<Table(?!\.)/g;
        const newContent = content.replace(regex, '<Table scroll={{ x: "max-content" }}');
        
        if (content !== newContent) {
          fs.writeFileSync(fullPath, newContent);
          console.log('Updated:', fullPath);
        }
      }
    }
  }
}

console.log('Starting table update...');
processDir('./src/features');
console.log('Done!');
