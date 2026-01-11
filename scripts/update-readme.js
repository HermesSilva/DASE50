const fs = require('fs');
const path = require('path');

function updateBadge(content, section, label, value, color) {
    const sectionHeader = `## ${section}`;
    const sectionIndex = content.indexOf(sectionHeader);
    if (sectionIndex === -1) {
        console.warn(`Section "${sectionHeader}" not found in README.md`);
        return content;
    }

    const nextSectionIndex = content.indexOf('## ', sectionIndex + sectionHeader.length);
    const searchArea = nextSectionIndex === -1 ? content.slice(sectionIndex) : content.slice(sectionIndex, nextSectionIndex);

    const badgeRegex = new RegExp(`!\\[${label}\\]\\(https:\\/\\/img\\.shields\\.io\\/badge\\/${label.toLowerCase()}-([^\\-]+)-([^\\)]+)\\)`, 'g');
    const newBadge = `![${label}](https://img.shields.io/badge/${label.toLowerCase()}-${encodeURIComponent(value)}-${color})`;

    if (!badgeRegex.test(searchArea)) {
        console.warn(`Badge for "${label}" not found in section "${section}"`);
        return content;
    }

    const updatedArea = searchArea.replace(badgeRegex, newBadge);

    if (nextSectionIndex === -1) {
        return content.slice(0, sectionIndex) + updatedArea;
    } else {
        return content.slice(0, sectionIndex) + updatedArea + content.slice(nextSectionIndex);
    }
}

function getTfxStats() {
    let coverage = null;
    let tests = null;

    try {
        const coverageSummaryPath = path.join(__dirname, '../TFX/coverage/coverage-summary.json');
        if (fs.existsSync(coverageSummaryPath)) {
            const coverageSummary = JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf8'));
            coverage = `${Math.round(coverageSummary.total.lines.pct)}%`;
        }
    } catch (e) {
        console.warn('Could not read TFX coverage-summary.json', e.message);
    }

    try {
        const testResultsPath = path.join(__dirname, '../TFX/test-results.json');
        if (fs.existsSync(testResultsPath)) {
            const testResults = JSON.parse(fs.readFileSync(testResultsPath, 'utf8'));
            tests = `${testResults.numPassedTests} passed`;
        }
    } catch (e) {
        console.warn('Could not read TFX test-results.json', e.message);
    }

    return { coverage, tests };
}

function getDaseStats() {
    let coverage = null;
    let tests = null;

    try {
        const coverageSummaryPath = path.join(__dirname, '../DASE/coverage/coverage-summary.json');
        if (fs.existsSync(coverageSummaryPath)) {
            const coverageSummary = JSON.parse(fs.readFileSync(coverageSummaryPath, 'utf8'));
            coverage = `${Math.round(coverageSummary.total.lines.pct)}%`;
        }
    } catch (e) {
        console.warn('Could not read DASE coverage-summary.json', e.message);
    }

    try {
        const testResultsPath = path.join(__dirname, '../DASE/test-results.json');
        if (fs.existsSync(testResultsPath)) {
            const testResults = JSON.parse(fs.readFileSync(testResultsPath, 'utf8'));
            tests = `${testResults.numPassedTests} passed`;
        }
    } catch (e) {
        console.warn('Could not read DASE test-results.json', e.message);
    }

    return { coverage, tests };
}

function main() {
    const readmePath = path.join(__dirname, '../README.md');
    let content = fs.readFileSync(readmePath, 'utf8');

    const tfxStats = getTfxStats();
    const daseStats = getDaseStats();

    console.log('TFX Stats:', tfxStats);
    console.log('DASE Stats:', daseStats);

    if (tfxStats.coverage) content = updateBadge(content, 'TFX — Core Framework', 'Coverage', tfxStats.coverage, 'brightgreen');
    if (tfxStats.tests) content = updateBadge(content, 'TFX — Core Framework', 'Tests', tfxStats.tests, 'brightgreen');

    if (daseStats.coverage) content = updateBadge(content, 'DASE — VS Code Extension', 'Coverage', daseStats.coverage, 'brightgreen');
    if (daseStats.tests) content = updateBadge(content, 'DASE — VS Code Extension', 'Tests', daseStats.tests, 'brightgreen');

    fs.writeFileSync(readmePath, content);
    console.log('README.md updated successfully.');
}

main();
