class JSONDiffViewer {
    constructor() {
        this.originalJsonTextarea = document.getElementById('original-json');
        this.patchJsonTextarea = document.getElementById('patch-json');
        this.generateDiffButton = document.getElementById('generate-diff');
        this.diffOutput = document.getElementById('diff-output');
        
        this.init();
    }
    
    init() {
        this.generateDiffButton.addEventListener('click', () => {
            this.generateDiff();
        });
        
        // Add example data
        this.loadExampleData();
    }
    
    loadExampleData() {
        const exampleOriginal = {
            "name": "John Doe",
            "age": 30,
            "city": "New York",
            "hobbies": ["reading", "swimming"],
            "address": {
                "street": "123 Main St",
                "zip": "10001"
            }
        };
        
        const examplePatch = [
            {"op": "replace", "path": "/age", "value": 31},
            {"op": "add", "path": "/email", "value": "john@example.com"},
            {"op": "remove", "path": "/city"},
            {"op": "add", "path": "/hobbies/-", "value": "cycling"},
            {"op": "replace", "path": "/address/street", "value": "456 Oak Ave"}
        ];
        
        this.originalJsonTextarea.value = JSON.stringify(exampleOriginal, null, 2);
        this.patchJsonTextarea.value = JSON.stringify(examplePatch, null, 2);
    }
    
    generateDiff() {
        try {
            const originalJson = JSON.parse(this.originalJsonTextarea.value);
            const patchArray = JSON.parse(this.patchJsonTextarea.value);
            
            // Apply patches and track changes
            const result = this.applyPatches(originalJson, patchArray);
            
            // Generate diff visualization
            this.displayDiff(originalJson, result.patched, result.changes);
            
        } catch (error) {
            this.displayError(`Error: ${error.message}`);
        }
    }
    
    applyPatches(original, patches) {
        const patched = JSON.parse(JSON.stringify(original)); // Deep clone
        const changes = [];
        
        for (const patch of patches) {
            try {
                const change = this.applyPatch(patched, patch);
                if (change) {
                    changes.push(change);
                }
            } catch (error) {
                throw new Error(`Failed to apply patch ${JSON.stringify(patch)}: ${error.message}`);
            }
        }
        
        return { patched, changes };
    }
    
    applyPatch(obj, patch) {
        const { op, path, value } = patch;
        const pathArray = this.parsePath(path);
        
        switch (op) {
            case 'add':
                return this.addOperation(obj, pathArray, value);
            case 'remove':
                return this.removeOperation(obj, pathArray);
            case 'replace':
                return this.replaceOperation(obj, pathArray, value);
            case 'copy':
                return this.copyOperation(obj, pathArray, patch.from);
            case 'move':
                return this.moveOperation(obj, pathArray, patch.from);
            case 'test':
                return this.testOperation(obj, pathArray, value);
            default:
                throw new Error(`Unknown operation: ${op}`);
        }
    }
    
    parsePath(path) {
        if (path === '') return [];
        return path.split('/').slice(1).map(segment => {
            // Handle array indices and special characters
            if (segment === '-') return '-';
            if (/^\d+$/.test(segment)) return parseInt(segment);
            return segment.replace(/~1/g, '/').replace(/~0/g, '~');
        });
    }
    
    addOperation(obj, pathArray, value) {
        const parent = this.getParent(obj, pathArray);
        const key = pathArray[pathArray.length - 1];
        
        if (Array.isArray(parent)) {
            if (key === '-') {
                const newIndex = parent.length;
                parent.push(value);
                // Update the path to include the actual index for tracking
                const actualPath = [...pathArray.slice(0, -1), newIndex];
                return { type: 'add', path: actualPath, value, index: newIndex };
            } else {
                parent.splice(key, 0, value);
                return { type: 'add', path: pathArray, value, index: key };
            }
        } else {
            parent[key] = value;
            return { type: 'add', path: pathArray, value };
        }
    }
    
    removeOperation(obj, pathArray) {
        const parent = this.getParent(obj, pathArray);
        const key = pathArray[pathArray.length - 1];
        const oldValue = parent[key];
        
        if (Array.isArray(parent)) {
            parent.splice(key, 1);
        } else {
            delete parent[key];
        }
        
        return { type: 'remove', path: pathArray, oldValue };
    }
    
    replaceOperation(obj, pathArray, value) {
        const parent = this.getParent(obj, pathArray);
        const key = pathArray[pathArray.length - 1];
        const oldValue = parent[key];
        
        parent[key] = value;
        return { type: 'replace', path: pathArray, oldValue, value };
    }
    
    copyOperation(obj, pathArray, fromPath) {
        const fromPathArray = this.parsePath(fromPath);
        const value = this.getValue(obj, fromPathArray);
        return this.addOperation(obj, pathArray, JSON.parse(JSON.stringify(value)));
    }
    
    moveOperation(obj, pathArray, fromPath) {
        const fromPathArray = this.parsePath(fromPath);
        const value = this.getValue(obj, fromPathArray);
        this.removeOperation(obj, fromPathArray);
        return this.addOperation(obj, pathArray, value);
    }
    
    testOperation(obj, pathArray, value) {
        const actualValue = this.getValue(obj, pathArray);
        if (JSON.stringify(actualValue) !== JSON.stringify(value)) {
            throw new Error(`Test failed: expected ${JSON.stringify(value)}, got ${JSON.stringify(actualValue)}`);
        }
        return null;
    }
    
    getParent(obj, pathArray) {
        let current = obj;
        for (let i = 0; i < pathArray.length - 1; i++) {
            current = current[pathArray[i]];
            if (current === undefined) {
                throw new Error(`Path not found: ${pathArray.slice(0, i + 1).join('/')}`);
            }
        }
        return current;
    }
    
    getValue(obj, pathArray) {
        let current = obj;
        for (const segment of pathArray) {
            current = current[segment];
            if (current === undefined) {
                throw new Error(`Path not found: ${pathArray.join('/')}`);
            }
        }
        return current;
    }
    
    displayDiff(original, patched, changes) {
        const diffResult = this.createSemanticDiff(original, patched, changes);
        
        this.diffOutput.innerHTML = '';
        
        diffResult.forEach((line, index) => {
            const lineElement = document.createElement('div');
            lineElement.className = `diff-line ${line.type}`;
            
            const lineNumber = document.createElement('div');
            lineNumber.className = 'diff-line-number';
            lineNumber.textContent = index + 1;
            
            const lineContent = document.createElement('div');
            lineContent.className = 'diff-line-content';
            lineContent.textContent = line.content;
            
            lineElement.appendChild(lineNumber);
            lineElement.appendChild(lineContent);
            this.diffOutput.appendChild(lineElement);
        });
    }
    
    createSemanticDiff(original, patched, changes) {
        const result = [];
        
        // Create maps to track what changed
        const changesByPath = new Map();
        changes.forEach(change => {
            const pathKey = change.path.join('/');
            changesByPath.set(pathKey, change);
        });
        
        this.generateAnnotatedLines(patched, [], changesByPath, result, original);
        
        return result;
    }
    
    generateAnnotatedLines(obj, currentPath, changesByPath, result, originalObj) {
        const indent = '  '.repeat(currentPath.length);
        
        if (Array.isArray(obj)) {
            result.push({ type: 'unchanged', content: indent + '[' });
            
            obj.forEach((item, index) => {
                const itemPath = [...currentPath, index];
                const pathKey = itemPath.join('/');
                const change = changesByPath.get(pathKey);
                
                if (typeof item === 'object' && item !== null) {
                    this.generateAnnotatedLines(item, itemPath, changesByPath, result, this.getValueAtPath(originalObj, itemPath));
                } else {
                    const line = indent + '  ' + JSON.stringify(item) + (index < obj.length - 1 ? ',' : '');
                    
                    // Check if this item was added
                    if (change && change.type === 'add') {
                        result.push({ type: 'added', content: line });
                    } else {
                        // Check if this is a new item that wasn't in the original
                        const originalArray = this.getValueAtPath(originalObj, currentPath);
                        if (Array.isArray(originalArray) && index >= originalArray.length) {
                            result.push({ type: 'added', content: line });
                        } else {
                            result.push({ type: 'unchanged', content: line });
                        }
                    }
                }
            });
            
            const originalArray = this.getValueAtPath(originalObj, currentPath);
            if (Array.isArray(originalArray) && originalArray.length > obj.length) {
                for (let i = obj.length; i < originalArray.length; i++) {
                    const removedItem = originalArray[i];
                    const line = indent + '  ' + JSON.stringify(removedItem) + ',';
                    result.push({ type: 'removed', content: line });
                }
            }
            
            result.push({ type: 'unchanged', content: indent + ']' + (currentPath.length > 0 ? ',' : '') });
            
        } else if (typeof obj === 'object' && obj !== null) {
            result.push({ type: 'unchanged', content: indent + '{' });
            
            const keys = Object.keys(obj);
            keys.forEach((key, index) => {
                const itemPath = [...currentPath, key];
                const pathKey = itemPath.join('/');
                const change = changesByPath.get(pathKey);
                const value = obj[key];
                
                if (typeof value === 'object' && value !== null) {
                    const keyLine = indent + '  ' + JSON.stringify(key) + ': ';
                    
                    // Check if this entire object/array was added
                    if (change && change.type === 'add') {
                        result.push({ type: 'added', content: keyLine.slice(0, -2) });
                        // Mark the entire nested structure as added
                        this.generateAnnotatedLinesWithType(value, itemPath, 'added', result);
                    } else {
                        result.push({ type: 'unchanged', content: keyLine.slice(0, -2) });
                        this.generateAnnotatedLines(value, itemPath, changesByPath, result, this.getValueAtPath(originalObj, itemPath));
                    }
                } else {
                    const line = indent + '  ' + JSON.stringify(key) + ': ' + JSON.stringify(value) + (index < keys.length - 1 ? ',' : '');
                    
                    if (change) {
                        if (change.type === 'add') {
                            result.push({ type: 'added', content: line });
                        } else if (change.type === 'replace') {
                            const oldLine = indent + '  ' + JSON.stringify(key) + ': ' + JSON.stringify(change.oldValue) + (index < keys.length - 1 ? ',' : '');
                            result.push({ type: 'removed', content: oldLine });
                            result.push({ type: 'added', content: line });
                        }
                    } else {
                        result.push({ type: 'unchanged', content: line });
                    }
                }
            });
            
            // Check for removed keys
            const originalObj_atPath = this.getValueAtPath(originalObj, currentPath);
            if (typeof originalObj_atPath === 'object' && originalObj_atPath !== null) {
                Object.keys(originalObj_atPath).forEach(key => {
                    if (!(key in obj)) {
                        const pathKey = [...currentPath, key].join('/');
                        const change = changesByPath.get(pathKey);
                        if (change && change.type === 'remove') {
                            const removedValue = originalObj_atPath[key];
                            const line = indent + '  ' + JSON.stringify(key) + ': ' + JSON.stringify(removedValue) + ',';
                            result.push({ type: 'removed', content: line });
                        }
                    }
                });
            }
            
            result.push({ type: 'unchanged', content: indent + '}' + (currentPath.length > 0 ? ',' : '') });
        }
    }
    
    generateAnnotatedLinesWithType(obj, currentPath, lineType, result) {
        const indent = '  '.repeat(currentPath.length);
        const jsonStr = JSON.stringify(obj, null, 2);
        const lines = jsonStr.split('\n');
        
        lines.forEach((line, index) => {
            if (index === 0) {
                result.push({ type: lineType, content: line });
            } else {
                result.push({ type: lineType, content: indent + line });
            }
        });
    }
    
    getValueAtPath(obj, path) {
        let current = obj;
        for (const segment of path) {
            if (current === null || current === undefined) {
                return undefined;
            }
            current = current[segment];
        }
        return current;
    }
    
    displayError(message) {
        this.diffOutput.innerHTML = `<div class="error">${message}</div>`;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new JSONDiffViewer();
});
