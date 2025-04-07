#!/usr/bin/env node

/**
 * Script to optimize Material-UI icon imports across the codebase
 * This script looks for group imports from @mui/icons-material and
 * converts them to individual path imports.
 * 
 * Run with: node optimize-mui-imports.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Source directory to scan
const srcDir = path.join(__dirname, 'src');

function findJSXFiles(dir) {
  const files = [];
  
  function traverse(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        traverse(fullPath);
      } else if (entry.isFile() && /\.(jsx?|tsx?)$/.test(entry.name)) {
        files.push(fullPath);
      }
    }
  }
  
  traverse(dir);
  return files;
}

function optimizeImports(filePath) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Regular expression to find MUI icon imports
  const importRegex = /import\s+{([^}]*)}\s+from\s+['"]@mui\/icons-material['"];?/g;
  
  let match;
  let modified = false;
  
  while ((match = importRegex.exec(content)) !== null) {
    const importBlock = match[0];
    const importedIcons = match[1].split(',').map(item => item.trim());
    
    // Generate individual imports
    const individualImports = importedIcons
      .filter(icon => icon) // Remove empty entries
      .map(icon => {
        // Handle renamed imports like "Add as AddIcon"
        const parts = icon.split(' as ');
        const iconName = parts[0].trim();
        const iconAlias = parts.length > 1 ? parts[1].trim() : iconName;
        
        return `import ${iconAlias} from '@mui/icons-material/${iconName}';`;
      })
      .join('\n');
    
    if (individualImports) {
      content = content.replace(importBlock, individualImports);
      modified = true;
    }
  }
  
  if (modified) {
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✅ Optimized MUI icon imports in ${path.relative(__dirname, filePath)}`);
    return true;
  }
  
  return false;
}

// Main execution
console.log('🔍 Scanning for files with MUI icon imports...');
const files = findJSXFiles(srcDir);
let optimizedCount = 0;

for (const file of files) {
  if (optimizeImports(file)) {
    optimizedCount++;
  }
}

console.log(`\n✨ Done! Optimized MUI icon imports in ${optimizedCount} file(s).`);