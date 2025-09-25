let currentCharacterFrames = { neutral: null, talking: null };
let uploadedNeutralDataUrl = null; // new: store uploaded start frame
let isGenerating = false;
let isSpeaking = false;
let talkInterval = null;

const characterImg = document.getElementById('character');
const mouthOverlay = document.getElementById('mouthOverlay');
const textInput = document.getElementById('textInput');
const generateBtn = document.getElementById('generateBtn');
const speakBtn = document.getElementById('speakBtn');
const status = document.getElementById('status');
const uploadInput = document.getElementById('uploadInput');
const useUploadBtn = document.getElementById('useUploadBtn');

generateBtn.addEventListener('click', generateCharacter);
speakBtn.addEventListener('click', speakText);
useUploadBtn.addEventListener('click', () => {
    const file = uploadInput.files && uploadInput.files[0];
    if (!file) {
        status.textContent = 'Please choose an image file to upload first.';
        return;
    }
    const reader = new FileReader();
    reader.onload = () => {
        uploadedNeutralDataUrl = reader.result;
        currentCharacterFrames.neutral = uploadedNeutralDataUrl;
        characterImg.src = uploadedNeutralDataUrl;
        status.textContent = 'Uploaded image set as neutral frame. Now click "Generate Character" to create talking frame.';
        // After upload, switch input placeholder to generate prompt for talking frame if desired
        textInput.placeholder = 'Enter prompt for talking frame / style...';
        // Show the uploaded image in the character display immediately
        characterImg.style.display = 'block';
    };
    reader.readAsDataURL(file);
});

async function generateCharacter() {
    if (isGenerating) return;
    
    // new: require a prompt from the input before generating
    const promptText = textInput.value.trim();
    if (!promptText) {
        status.textContent = 'Please enter a prompt to generate the character.';
        return;
    }
    
    isGenerating = true;
    generateBtn.disabled = true;
    status.textContent = 'Generating character... This may take about 20 seconds (1-2 images).';
    
    try {
        let result1 = null;
        // If an uploaded neutral exists, use it instead of generating with Flux Schnell
        if (uploadedNeutralDataUrl) {
            status.textContent = 'Using uploaded neutral frame...';
            currentCharacterFrames.neutral = uploadedNeutralDataUrl;
            characterImg.src = currentCharacterFrames.neutral;
            // convert dataURL to blob-like input for imageGen if needed
            result1 = { url: currentCharacterFrames.neutral };
        } else {
            // Generate first frame using Flux Schnell
            status.textContent = 'Generating neutral frame with Flux Schnell...';
            result1 = await websim.imageGen({
                prompt: promptText, // use user's input as generation prompt
                width: 512,
                height: 512
            });
            currentCharacterFrames.neutral = result1.url;
            characterImg.src = currentCharacterFrames.neutral;
        }
        
        // Generate talking frame using Nano Bananas by showing the first image
        status.textContent = 'Generating talking frame with Nano Bananas...';
        
        // Convert first image to base64 for input (handle dataURL already)
        let base64;
        if (result1.url.startsWith('data:')) {
            base64 = result1.url;
        } else {
            const response = await fetch(result1.url);
            const blob = await response.blob();
            base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.readAsDataURL(blob);
            });
        }
        
        const result2 = await websim.imageGen({
            prompt: "Make this character's mouth open as if talking or speaking, keep the same art style and colors",
            image_inputs: [{ url: base64 }],
            width: 512,
            height: 512
        });
        
        currentCharacterFrames.talking = result2.url;
        
        // After generation, switch the input to be a TTS input
        status.textContent = 'Character generated with 2 frames! Now enter text to speak.';
        textInput.value = '';
        textInput.placeholder = 'Enter text to speak...';
        textInput.disabled = false;
        speakBtn.disabled = false;
    } catch (error) {
        console.error('Error generating character:', error);
        status.textContent = 'Error generating character. Please try again.';
    } finally {
        isGenerating = false;
        generateBtn.disabled = false;
    }
}

async function speakText() {
    if (isSpeaking || !textInput.value.trim()) return;
    
    isSpeaking = true;
    speakBtn.disabled = true;
    const text = textInput.value;
    
    try {
        // Generate speech
        status.textContent = 'Generating speech...';
        const ttsResult = await websim.textToSpeech({
            text: text,
            voice: 'en-male'
        });
        
        // Create audio element
        const audio = new Audio(ttsResult.url);
        
        // Start mouth animation by cycling frames
        let showTalking = true;
        characterImg.src = currentCharacterFrames.talking;
        talkInterval = setInterval(() => {
            characterImg.src = showTalking ? currentCharacterFrames.talking : currentCharacterFrames.neutral;
            showTalking = !showTalking;
        }, 200); // toggle every 200ms
        
        // Play audio
        audio.play();
        
        // Update status
        status.textContent = 'Character is speaking...';
        
        // Stop animation when audio ends
        audio.addEventListener('ended', () => {
            clearInterval(talkInterval);
            talkInterval = null;
            characterImg.src = currentCharacterFrames.neutral;
            isSpeaking = false;
            speakBtn.disabled = false;
            status.textContent = 'Ready to speak again!';
        });
        
        // Handle audio errors
        audio.addEventListener('error', () => {
            if (talkInterval) { clearInterval(talkInterval); talkInterval = null; }
            characterImg.src = currentCharacterFrames.neutral;
            isSpeaking = false;
            speakBtn.disabled = false;
            status.textContent = 'Error playing audio. Please try again.';
        });
        
    } catch (error) {
        console.error('Error with TTS:', error);
        if (talkInterval) { clearInterval(talkInterval); talkInterval = null; }
        characterImg.src = currentCharacterFrames.neutral;
        isSpeaking = false;
        speakBtn.disabled = false;
        status.textContent = 'Error generating speech. Please try again.';
    }
}

// Initialize UI state
textInput.disabled = false; // allow entering prompt for generation initially
speakBtn.disabled = true;