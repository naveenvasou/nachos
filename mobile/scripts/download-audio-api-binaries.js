const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

// Configuration
const VERSION = 'v2.0.0';
const BASE_URL = `https://github.com/software-mansion-labs/rn-audio-libs/releases/download/${VERSION}`;
const FILES = [
    'armeabi-v7a.zip',
    'arm64-v8a.zip',
    'x86.zip',
    'x86_64.zip',
    'jniLibs.zip'
];

// Paths
const MOBILE_ROOT = path.resolve(__dirname, '..');
const RNA_ROOT = path.resolve(MOBILE_ROOT, 'node_modules', 'react-native-audio-api');
const TEMP_DIR = path.resolve(MOBILE_ROOT, 'audioapi-binaries-temp');

// Destinations
const JNI_LIBS_DEST = path.resolve(RNA_ROOT, 'android', 'src', 'main');
const EXTERNAL_LIBS_DEST = path.resolve(RNA_ROOT, 'common', 'cpp', 'audioapi', 'external');

// Ensure directories exist
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}

// Download file with redirect support
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const request = https.get(url, (response) => {
            // Handle redirects
            if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 303 || response.statusCode === 307) {
                if (response.headers.location) {
                    console.log(`Redirecting to ${response.headers.location}...`);
                    file.close();
                    downloadFile(response.headers.location, dest).then(resolve).catch(reject);
                    return;
                }
            }

            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download ${url}: Status Code ${response.statusCode}`));
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        });

        request.on('error', (err) => {
            fs.unlink(dest, () => { });
            reject(err);
        });
    });
}

// Unzip file
function unzipFile(zipPath, destDir) {
    try {
        // Check if tar/unzip is available or use a library. 
        // Since this is a dev environment, we likely have tar or unzip. 
        // Windows might have tar. Let's try to use powershell for windows if tar fails, 
        // but 'tar -xf' works on Windows 10+ usually.
        // However, standard zip files need a tool.
        // Let's assume 'tar' exists and supports zip (recent bsdtar on windows does).
        // Actually, let's use a simpler approach: 
        // We are in a node script. We might not have 'unzip' on windows command line easily available without git bash.
        // I'll try 'tar -xf'. If that fails, I might need 'adm-zip' but I don't want to add dev deps if I can avoid it.
        // Let's assume the user has 'tar' (standard on Windows 10+).

        console.log(`Unzipping ${zipPath} to ${destDir}...`);
        // 'tar' on windows often handles zip with -xf.
        // Specifying cwd for tar to extract INTO.
        // -C changes directory.
        execSync(`tar -xf "${zipPath}" -C "${destDir}"`);
    } catch (e) {
        console.warn("tar failed, trying powershell Expand-Archive...");
        try {
            execSync(`powershell -command "Expand-Archive -Path '${zipPath}' -DestinationPath '${destDir}' -Force"`);
        } catch (e2) {
            console.error(`Failed to unzip ${zipPath}.`, e2);
            throw e2;
        }
    }
}

async function main() {
    console.log('Checking react-native-audio-api binaries...');

    if (!fs.existsSync(RNA_ROOT)) {
        console.log('react-native-audio-api not found in node_modules. Skipping.');
        return;
    }

    ensureDir(TEMP_DIR);
    ensureDir(JNI_LIBS_DEST);
    ensureDir(EXTERNAL_LIBS_DEST);

    for (const file of FILES) {
        const isJni = file === 'jniLibs.zip';
        const destDir = isJni ? JNI_LIBS_DEST : EXTERNAL_LIBS_DEST;
        const nameWithoutExt = path.basename(file, '.zip');

        // Check if destination exists (rough check to avoid redownloading)
        // For jniLibs, it extracts into 'jniLibs' folder usually? 
        // Let's look at the bash script: 
        // It extracts to OUTPUT_DIR. 
        // For jniLibs.zip, OUTPUT_DIR is jniLibs src main. 
        // For others, it is external/NAME.

        let targetCheckPath;
        if (isJni) {
            // jniLibs.zip probably contains a 'jniLibs' folder or just the libs?
            // Bash script: EXTRACTED_DIR_NAME = jniLibs
            // FINAL_CHECK_PATH = OUTPUT_DIR/jniLibs
            targetCheckPath = path.join(destDir, 'jniLibs');
        } else {
            targetCheckPath = path.join(destDir, nameWithoutExt);
        }

        if (fs.existsSync(targetCheckPath)) {
            console.log(`${file} seems to be present at ${targetCheckPath}. Skipping.`);
            continue;
        }

        console.log(`Downloading ${file}...`);
        const zipPath = path.join(TEMP_DIR, file);
        await downloadFile(`${BASE_URL}/${file}`, zipPath);

        await unzipFile(zipPath, destDir);
    }

    // Cleanup
    console.log('Cleaning up temp files...');
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });

    console.log('react-native-audio-api binaries setup complete.');
}

main().catch(err => {
    console.error('Error setting up audio binaries:', err);
    process.exit(1);
});
