const fs = require('fs');
const path = require('path');

// Function to convert UTF-16 to UTF-8
function fixFileEncoding(filePath) {
  try {
    // Read file as buffer
    let buffer = fs.readFileSync(filePath);
    
    // Check if it's UTF-16LE BOM
    if (buffer[0] === 0xFF && buffer[1] === 0xFE) {
      // UTF-16LE BOM
      let content = buffer.toString('utf16le');
      // Remove BOM if present
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.substring(1);
      }
      
      // Write back as UTF-8 without BOM
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed UTF-16LE: ${filePath}`);
      return true;
    } else if (buffer[0] === 0xFE && buffer[1] === 0xFF) {
      // UTF-16BE BOM
      let content = buffer.toString('utf16be');
      if (content.charCodeAt(0) === 0xFEFF) {
        content = content.substring(1);
      }
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`Fixed UTF-16BE: ${filePath}`);
      return true;
    } else {
      // Check if it's UTF-8 with BOM
      if (buffer[0] === 0xEF && buffer[1] === 0xBB && buffer[2] === 0xBF) {
        let content = buffer.toString('utf8').substring(1);
        fs.writeFileSync(filePath, content, 'utf8');
        console.log(`Removed UTF-8 BOM: ${filePath}`);
        return true;
      }
    }
    
    console.log(`No encoding issues found: ${filePath}`);
    return false;
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return false;
  }
}

// Fix the problematic files
const filesToFix = [
  'src/App.tsx',
  'src/utils/ccxtService.ts'
];

console.log('Fixing file encoding issues...\n');
filesToFix.forEach(file => {
  if (fs.existsSync(file)) {
    fixFileEncoding(file);
  } else {
    console.log(`File not found: ${file}`);
  }
});

console.log('\nDone!');
