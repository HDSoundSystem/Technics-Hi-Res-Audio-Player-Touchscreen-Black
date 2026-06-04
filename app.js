const audio = document.getElementById('audioPlayer');
const fileInput = document.getElementById('fileInput');
const statusDisp = document.getElementById('statusDisplay');
const volInd = document.getElementById('volumeIndicator');
const bassInd = document.getElementById('bassIndicator');
const trebleInd = document.getElementById('trebleIndicator');
const muteInd = document.getElementById('muteIndicator');
const playStateInd = document.getElementById('playStateIndicator');
const toneMenu = document.getElementById('toneMenu');
const settingsMenu = document.getElementById('settingsMenu');
const playlistMenu = document.getElementById('playlistMenu');
const progressBar = document.getElementById('progressBar');
const standbyLogo = document.getElementById('standbyLogo');
const mainScreen = document.getElementById('mainScreen');
const appBgColorPicker = document.getElementById('appBgColorPicker');
const vuContainer = document.getElementById('vuContainer');

let vuAnimationRunning = false;

function updateVolumeIndicator() {
    if (volInd) {
        if (playlist.length > 0) {
            volInd.textContent = 'VOL ' + Math.round(audio.volume * 100) + '%';
            volInd.style.display = 'block';
        } else {
            volInd.style.display = 'none';
        }
    }
}

function updateToneIndicators() {
    if (bassInd) {
        if (playlist.length > 0 && bassGain !== 0) {
            bassInd.textContent = 'BASS ' + (bassGain > 0 ? '+' : '') + bassGain + 'dB';
            bassInd.style.display = 'block';
        } else {
            bassInd.style.display = 'none';
        }
    }
    if (trebleInd) {
        if (playlist.length > 0 && trebleGain !== 0) {
            trebleInd.textContent = 'TREBLE ' + (trebleGain > 0 ? '+' : '') + trebleGain + 'dB';
            trebleInd.style.display = 'block';
        } else {
            trebleInd.style.display = 'none';
        }
    }
}

const vuToggleBtn = document.getElementById('vuToggleBtn');
const vuSenseDisplay = document.getElementById('vuSenseDisplay');
const powerModal = document.getElementById('powerModal');
document.getElementById('pwrBtn').addEventListener('click', () => {
    powerModal.classList.add('active');
});
document.getElementById('modalCancel').addEventListener('click', () => {
    powerModal.classList.remove('active');
});
document.getElementById('modalConfirm').addEventListener('click', () => {
    location.reload();
});
powerModal.addEventListener('click', (e) => {
    if (e.target === powerModal) powerModal.classList.remove('active');
});

const SEGMENT_COUNT = 30;
let audioCtx, source, bassFilter, trebleFilter, analyser, loudnessBassFilter, loudnessTrebleFilter;
let dspMidFilter, dspMidFilter2, dspPresenceFilter, dspAirFilter;
let currentDspPreset = 'flat';
let splitter, spectrumAnalyserL, spectrumAnalyserR;
let isLoudnessActive = false;
let peakL = 0, peakR = 0, peakTimerL = 0, peakTimerR = 0;
let bassGain = 0, trebleGain = 0, isVuActive = true, vuSensitivity = 3.0, analogSensitivity = 1.8, isSpectrumMode = true, isAnalogMode = false;
let playlist = [], currentIndex = 0;
let isShuffle = false, repeatMode = 0, volInterval = null, seekInterval = null;

function createVuSegments(containerId) {
    const container = document.getElementById(containerId);
    container.innerHTML = "";
    for (let i = 0; i < SEGMENT_COUNT; i++) {
        const seg = document.createElement('div');
        seg.className = 'vu-segment';
        container.appendChild(seg);
    }
}
createVuSegments('vuLBar');
createVuSegments('vuRBar');

audio.volume = 0.02;

function updateStatus(text) {
    statusDisp.innerText = text;
    statusDisp.classList.add('visible');
    clearTimeout(window.statusTimer);
    window.statusTimer = setTimeout(() => statusDisp.classList.remove('visible'), 2000);
}

function savePreferences() {
    localStorage.setItem('technics_prefs_v12', JSON.stringify({
        volume: audio.volume, bass: bassGain, treble: trebleGain, dspPreset: currentDspPreset, waveform: waveformEnabled,
        appBackground: appBgColorPicker.value, vuActive: isVuActive, vuSensitivity: vuSensitivity, analogSensitivity: analogSensitivity, loudness: isLoudnessActive,
        artBgActive: isArtBgActive, theme: currentTheme
    }));
}

function loadPreferences() {
    const saved = localStorage.getItem('technics_prefs_v12');
    if (saved) {
        const p = JSON.parse(saved);
        audio.volume = p.volume || 0.02;
        bassGain = p.bass || 0;
        trebleGain = p.treble || 0;
        if (p.dspPreset) currentDspPreset = p.dspPreset;
        if (p.waveform !== undefined) waveformEnabled = p.waveform;
        vuSensitivity = p.vuSensitivity || 3.0;
        analogSensitivity = p.analogSensitivity || 1.8;
        isVuActive = p.vuActive !== undefined ? p.vuActive : true;
        vuSenseDisplay.innerText = Math.round(vuSensitivity * 100) + '%';
        const analogSenseDisp = document.getElementById('analogSenseDisplay');
        if (analogSenseDisp) analogSenseDisp.innerText = Math.round(analogSensitivity * 100) + '%';
        if (p.loudness) { isLoudnessActive = p.loudness; const btn = document.getElementById('loudnessBtn'); if (btn) { btn.textContent = isLoudnessActive ? 'ON' : 'OFF'; btn.classList.toggle('active', isLoudnessActive); } const loudInd = document.getElementById('loudnessIndicator'); if (loudInd && isLoudnessActive) loudInd.style.display = 'block'; }
        if (p.appBackground) { appBgColorPicker.value = p.appBackground; updateAppBackground(p.appBackground); }
        if (p.artBgActive) {
            isArtBgActive = true;
            const btn = document.getElementById('artBgToggleBtn');
            if (btn) { btn.textContent = 'ON'; btn.classList.add('active'); }
            document.getElementById('artworkBg').classList.add('active');
        }
        if (p.theme) { setTheme(p.theme); }
    }
    updateVolumeIndicator();
    updateToneIndicators();
    vuToggleBtn.innerText = isVuActive ? "ON" : "OFF";
    vuToggleBtn.classList.toggle('active', isVuActive);
}

function updateAppBackground(color) { document.body.style.backgroundColor = color; savePreferences(); }

let currentTheme = 'black';

function setTheme(theme) {
    currentTheme = theme;
    const chassis = document.getElementById('chassisMain');
    const brandLogo = document.getElementById('chassisBrandLogo');
    const classAa = document.getElementById('classAaLogo');
    const pwrBtn = document.getElementById('pwrBtn');
    const pwrLabel = document.querySelector('.pwr-label');
    const silverBtn = document.getElementById('themeSilverBtn');
    const blackBtn = document.getElementById('themeBlackBtn');

    if (theme === 'silver') {
        // Chassis image
        chassis.style.backgroundImage = "linear-gradient(90deg, rgba(105,105,105,0.25) 0%, rgba(0,0,0,0.425) 50%, rgba(105,105,105,0.25) 100%), url('img/chassis_w.png')";
        // Brand logo (chassis only)
        if (brandLogo) brandLogo.src = 'img/technics_brand_2.webp';
        // Class AA logo
        if (classAa) classAa.src = 'img/class_aa_3.png';
        // Power button & label from theme.css
        if (pwrBtn) {
            pwrBtn.style.background = "conic-gradient(from -90deg, #d8d8d8 0%, #ffffff 5%, #d8d8d8 10%, #bfbfbf 15%, #d8d8d8 20%, #ffffff 25%, #d8d8d8 30%, #bfbfbf 35%, #d8d8d8 40%, #ffffff 45%, #d8d8d8 50%, #bfbfbf 55%, #d8d8d8 60%, #ffffff 65%, #d8d8d8 70%, #bfbfbf 75%, #d8d8d8 80%, #ffffff 85%, #d8d8d8 90%, #bfbfbf 95%, #d8d8d8 100%), repeating-radial-gradient(circle, #e6e6e6 0px, #e6e6e6 1px, #d9d9d9 1px, #d9d9d9 2px)";
            pwrBtn.style.border = "2px solid rgba(8,8,8,0.452)";
            pwrBtn.style.boxShadow = "";
            pwrBtn.style.color = "#333";
        }
        if (pwrLabel) { pwrLabel.style.color = "#333"; pwrLabel.style.fontWeight = "300"; }
        // Theme buttons state
        if (silverBtn) silverBtn.classList.add('active');
        if (blackBtn) blackBtn.classList.remove('active');
    } else {
        // Restore black theme
        chassis.style.backgroundImage = "linear-gradient(90deg, rgba(105,105,105,0.25) 0%, rgba(0,0,0,0.425) 50%, rgba(105,105,105,0.25) 100%), url('img/chassis_b.png')";
        if (brandLogo) brandLogo.src = 'img/technics_brand_1.webp';
        if (classAa) classAa.src = 'img/class_aa_2.png';
        if (pwrBtn) {
            pwrBtn.style.background = "conic-gradient(from -90deg, #222222 0%, #444444 5%, #222222 10%, #151515 15%, #222222 20%, #444444 25%, #222222 30%, #151515 35%, #222222 40%, #444444 45%, #222222 50%, #151515 55%, #222222 60%, #444444 65%, #222222 70%, #151515 75%, #222222 80%, #444444 85%, #222222 90%, #151515 95%, #222222 100%), repeating-radial-gradient(circle, #2a2a2a 0px, #2a2a2a 1px, #1a1a1a 1px, #1a1a1a 2px)";
            pwrBtn.style.border = "2px solid rgba(0,0,0,0.8)";
            pwrBtn.style.boxShadow = "inset 0.5px 0.5px 1px rgba(255,255,255,0.2), 0 2px 4px rgba(0,0,0,0.4)";
            pwrBtn.style.color = "#acacac";
        }
        if (pwrLabel) { pwrLabel.style.color = "#acacac"; pwrLabel.style.fontWeight = "300"; }
        if (silverBtn) silverBtn.classList.remove('active');
        if (blackBtn) blackBtn.classList.add('active');
    }
    savePreferences();
}

let isArtBgActive = true;

function toggleArtBackground() {
    isArtBgActive = !isArtBgActive;
    const btn = document.getElementById('artBgToggleBtn');
    btn.textContent = isArtBgActive ? 'ON' : 'OFF';
    btn.classList.toggle('active', isArtBgActive);
    const bg = document.getElementById('artworkBg');
    if (isArtBgActive) {
        bg.classList.add('active');
    } else {
        bg.classList.remove('active');
    }
    savePreferences();
}

function updateArtworkBackground(coverUrl) {
    const bg = document.getElementById('artworkBg');
    if (coverUrl) {
        bg.style.backgroundImage = `url(${coverUrl})`;
    } else {
        bg.style.backgroundImage = 'none';
    }
}

function toggleVuDisplay() {
    isVuActive = !isVuActive;
    vuToggleBtn.innerText = isVuActive ? "ON" : "OFF";
    vuToggleBtn.classList.toggle('active', isVuActive);
    if (isVuActive && playlist.length > 0) vuContainer.classList.add('active');
    else vuContainer.classList.remove('active');
    if (isVuActive) initAudioContext();
    savePreferences();
}

vuToggleBtn.innerText = "ON";
vuToggleBtn.classList.add('active');

function adjustVuSensitivity(val) {
    vuSensitivity = Math.min(4.5, Math.max(0.1, vuSensitivity + val));
    vuSenseDisplay.innerText = Math.round(vuSensitivity * 100) + '%';
    updateStatus(`VU SENSE ${Math.round(vuSensitivity * 100)}%`);
    savePreferences();
}

function adjustAnalogSensitivity(val) {
    analogSensitivity = Math.min(4.5, Math.max(0.1, analogSensitivity + val));
    const analogSenseDisp = document.getElementById('analogSenseDisplay');
    if (analogSenseDisp) analogSenseDisp.innerText = Math.round(analogSensitivity * 100) + '%';
    updateStatus(`VU B SENSE ${Math.round(analogSensitivity * 100)}%`);
    savePreferences();
}


function initAudioContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        source = audioCtx.createMediaElementSource(audio);
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        analyser.smoothingTimeConstant = 0.55;

        splitter = audioCtx.createChannelSplitter(2);

        spectrumAnalyserL = audioCtx.createAnalyser();
        spectrumAnalyserL.fftSize = 1024;
        spectrumAnalyserL.smoothingTimeConstant = 0.75;

        spectrumAnalyserR = audioCtx.createAnalyser();
        spectrumAnalyserR.fftSize = 1024;
        spectrumAnalyserR.smoothingTimeConstant = 0.75;

        bassFilter = audioCtx.createBiquadFilter(); bassFilter.type = "lowshelf"; bassFilter.frequency.value = 100; bassFilter.gain.value = bassGain;
        trebleFilter = audioCtx.createBiquadFilter(); trebleFilter.type = "highshelf"; trebleFilter.frequency.value = 3000; trebleFilter.gain.value = trebleGain;

        // DSP preset filters
        dspMidFilter = audioCtx.createBiquadFilter(); dspMidFilter.type = "peaking"; dspMidFilter.frequency.value = 400; dspMidFilter.Q.value = 1.0; dspMidFilter.gain.value = 0;
        dspMidFilter2 = audioCtx.createBiquadFilter(); dspMidFilter2.type = "peaking"; dspMidFilter2.frequency.value = 1000; dspMidFilter2.Q.value = 1.2; dspMidFilter2.gain.value = 0;
        dspPresenceFilter = audioCtx.createBiquadFilter(); dspPresenceFilter.type = "peaking"; dspPresenceFilter.frequency.value = 3500; dspPresenceFilter.Q.value = 1.0; dspPresenceFilter.gain.value = 0;
        dspAirFilter = audioCtx.createBiquadFilter(); dspAirFilter.type = "highshelf"; dspAirFilter.frequency.value = 8000; dspAirFilter.gain.value = 0;

        loudnessBassFilter = audioCtx.createBiquadFilter();
        loudnessBassFilter.type = "lowshelf";
        loudnessBassFilter.frequency.value = 200;
        loudnessBassFilter.gain.value = 0;

        loudnessTrebleFilter = audioCtx.createBiquadFilter();
        loudnessTrebleFilter.type = "highshelf";
        loudnessTrebleFilter.frequency.value = 10000;
        loudnessTrebleFilter.gain.value = 0;

        source.connect(loudnessBassFilter)
            .connect(loudnessTrebleFilter)
            .connect(bassFilter)
            .connect(trebleFilter)
            .connect(dspMidFilter)
            .connect(dspMidFilter2)
            .connect(dspPresenceFilter)
            .connect(dspAirFilter)
            .connect(analyser)
            .connect(audioCtx.destination);

        dspAirFilter.connect(splitter);
        splitter.connect(spectrumAnalyserL, 0);
        splitter.connect(spectrumAnalyserR, 1);

        if (isLoudnessActive) {
            loudnessBassFilter.gain.value = 8;
            loudnessTrebleFilter.gain.value = 4;
        }

        if (currentDspPreset && currentDspPreset !== 'flat') {
            applyDspPreset(currentDspPreset);
        }
        drawVu();
    }
}

function toggleLoudness() {
    isLoudnessActive = !isLoudnessActive;
    const btn = document.getElementById('loudnessBtn');
    btn.textContent = isLoudnessActive ? 'ON' : 'OFF';
    btn.classList.toggle('active', isLoudnessActive);
    if (loudnessBassFilter) {
        loudnessBassFilter.gain.value = isLoudnessActive ? 8 : 0;
        loudnessTrebleFilter.gain.value = isLoudnessActive ? 4 : 0;
    }
    const loudInd = document.getElementById('loudnessIndicator');
    if (loudInd) loudInd.style.display = isLoudnessActive ? 'block' : 'none';

    savePreferences();
}

function adjustTone(type, amount) {
    initAudioContext();
    const preset = DSP_PRESETS[currentDspPreset] || DSP_PRESETS.flat;
    if (type === 'bass') {
        bassGain = Math.min(12, Math.max(-12, bassGain + amount));
        if (bassFilter) bassFilter.gain.value = bassGain + preset.bass;
    } else if (type === 'treble') {
        trebleGain = Math.min(12, Math.max(-12, trebleGain + amount));
        if (trebleFilter) trebleFilter.gain.value = trebleGain;
    }
    updateToneIndicators();
    savePreferences();
}

// DSP Presets
// bass(lowshelf@100) / mid(peaking@400) / mid2(peaking@1000) / presence(peaking@3500) / air(highshelf@8000)
const DSP_PRESETS = {
    //        bass(100Hz) mid(400Hz) mid2(1kHz) presence(3.5kHz) air(8kHz)
    flat: { bass: 0, mid: 0, mid2: 0, presence: 0, air: 0 },
    rock: { bass: 6, mid: -3, mid2: 0, presence: 4, air: 3 },
    pop: { bass: 3, mid: 1, mid2: 3, presence: 3, air: 2 },
    jazz: { bass: 4, mid: -2, mid2: 3, presence: 2, air: 0 },
    classic: { bass: 0, mid: 0, mid2: -2, presence: 2, air: 4 },
    live: { bass: -2, mid: 3, mid2: 2, presence: 5, air: 2 }
};

function applyDspPreset(preset) {
    currentDspPreset = preset;
    const p = DSP_PRESETS[preset];

    // Les 4 filtres DSP dédiés (mid, mid2, presence, air)
    if (dspMidFilter) dspMidFilter.gain.value = p.mid;
    if (dspMidFilter2) dspMidFilter2.gain.value = p.mid2;
    if (dspPresenceFilter) dspPresenceFilter.gain.value = p.presence;
    if (dspAirFilter) dspAirFilter.gain.value = p.air;

    // Le boost bass du preset s'ajoute au réglage manuel
    if (bassFilter) bassFilter.gain.value = bassGain + p.bass;

    // Mise à jour des boutons DSP
    ['rock', 'pop', 'jazz', 'classic', 'live', 'flat'].forEach(name => {
        const btn = document.getElementById('dspBtn_' + name);
        if (btn) btn.classList.toggle('active', name === preset);
    });

    // Indicateur écran
    const ind = document.getElementById('dspIndicator');
    if (ind) {
        if (preset === 'flat') {
            ind.style.display = 'none';
        } else {
            ind.textContent = 'DSP ' + preset.toUpperCase();
            ind.style.display = 'block';
        }
    }

    savePreferences();
}

function toggleDspPreset(preset) {
    initAudioContext();
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    if (currentDspPreset === preset && preset !== 'flat') {
        applyDspPreset('flat');
    } else {
        applyDspPreset(preset);
    }
}

function updateVuBars(level, peakIndex, containerId) {
    const segments = document.getElementById(containerId).getElementsByClassName('vu-segment');
    const numOn = Math.min(SEGMENT_COUNT, Math.floor((level / 100) * SEGMENT_COUNT));
    const redThreshold = Math.floor(SEGMENT_COUNT * 0.85);
    const orangeThreshold = Math.floor(SEGMENT_COUNT * 0.65);
    const peakSeg = Math.min(SEGMENT_COUNT - 1, Math.floor((peakIndex / 100) * SEGMENT_COUNT));

    for (let i = 0; i < SEGMENT_COUNT; i++) {
        segments[i].classList.remove('on-white', 'on-orange', 'on-red');

        const isPeak = (i === peakSeg && peakIndex > 5);
        const isOn = i < numOn;

        if (isPeak) {
            segments[i].classList.add('on-red');
        } else if (isOn) {
            if (i >= redThreshold) segments[i].classList.add('on-red');
            else if (i >= orangeThreshold) segments[i].classList.add('on-orange');
            else segments[i].classList.add('on-white');
        }
    }
}

const spectrumCanvas = document.getElementById('spectrumCanvas');
const spectrumCtx = spectrumCanvas ? spectrumCanvas.getContext('2d') : null;
let peakData = [];

function setVuMode(mode) {
    isSpectrumMode = (mode === 'spectrum');
    isAnalogMode = (mode === 'analog');
    vuContainer.classList.toggle('spectrum-mode', isSpectrumMode);
    vuContainer.classList.toggle('analog-mode', isAnalogMode);
    const specBtn = document.getElementById('spectrumToggleBtn');
    const vuBtn = document.getElementById('vuMeterToggleBtn');
    const analogBtn = document.getElementById('analogToggleBtn');
    if (specBtn) specBtn.classList.toggle('active', isSpectrumMode);
    if (vuBtn) vuBtn.classList.toggle('active', !isSpectrumMode && !isAnalogMode);
    if (analogBtn) analogBtn.classList.toggle('active', isAnalogMode);
}

// ── Analog VU —──────────────
const ANALOG_CFG = {
    ANGLE_REST: -45,   // angle repos (quasi couché)
    ANGLE_MAX: 110,   // débattement total depuis le repos
    SIGNAL_BOOST: 1.8,   // amplification du signal brut
    RESPONSE_CURVE: 1.5,   // 0.7 = légèrement log, comme un vrai VU
    SMOOTHING_ATTACK: 0.15,  // réactivité montée
    SMOOTHING_RELEASE: 0.08,  // retour lent au repos
};

const analogState = {
    L: { current: ANALOG_CFG.ANGLE_REST },
    R: { current: ANALOG_CFG.ANGLE_REST }
};

function getAnalogLevel(analyserNode) {
    if (!analyserNode) return 0;
    const buf = new Uint8Array(analyserNode.frequencyBinCount);
    analyserNode.getByteFrequencyData(buf);
    // moyenne des bins utiles (0–4 kHz environ)
    const usefulBins = Math.floor(buf.length * 0.15);
    let sum = 0;
    for (let i = 0; i < usefulBins; i++) sum += buf[i];
    return sum / usefulBins; // 0–255
}

function drawAnalogVu(isPlaying) {
    const rawL = getAnalogLevel(spectrumAnalyserL);
    const rawR = getAnalogLevel(spectrumAnalyserR);

    for (const [ch, raw] of [['L', rawL], ['R', rawR]]) {
        const s = ANALOG_CFG;
        let target;
        if (isPlaying) {
            const boosted = Math.min(255, raw * analogSensitivity);
            const normalized = Math.pow(boosted / 255, s.RESPONSE_CURVE);
            target = s.ANGLE_REST + normalized * s.ANGLE_MAX;
            analogState[ch].current += (target - analogState[ch].current) * s.SMOOTHING_ATTACK;
        } else {
            analogState[ch].current += (s.ANGLE_REST - analogState[ch].current) * s.SMOOTHING_RELEASE;
        }
        const group = document.getElementById('needleGroup' + ch);
        if (group) group.style.transform = `rotate(${analogState[ch].current}deg)`;
    }
}

function toggleVuMode() { setVuMode(isSpectrumMode ? 'vumeter' : 'spectrum'); }

function drawSpectrum(dataL, dataR) {
    if (!spectrumCanvas || !spectrumCtx) return;
    const W = spectrumCanvas.offsetWidth || spectrumCanvas.width;
    const H = spectrumCanvas.offsetHeight || spectrumCanvas.height;
    if (spectrumCanvas.width !== W) spectrumCanvas.width = W;
    if (spectrumCanvas.height !== H) spectrumCanvas.height = H;

    spectrumCtx.clearRect(0, 0, W, H);

    const SEP = 0;
    const halfW = Math.floor((W - SEP) / 2);
    const barCount = 22;
    const usefulBins = 30;
    const step = usefulBins / barCount;
    const barW = Math.floor(halfW / barCount) - 8;
    const barGap = Math.floor(halfW / barCount) - barW;
    const ledH = 2;
    const ledGap = 3;
    const ledStep = ledH + ledGap;
    const ledCount = 24;

    if (!drawSpectrum.stateL) {
        drawSpectrum.stateL = { peaks: new Array(barCount).fill(0), timers: new Array(barCount).fill(0) };
        drawSpectrum.stateR = { peaks: new Array(barCount).fill(0), timers: new Array(barCount).fill(0) };
    }

    spectrumCtx.fillStyle = '#222';
    spectrumCtx.fillRect(halfW, 0, SEP, H);

    [[dataL, 0, drawSpectrum.stateL], [dataR || dataL, halfW + SEP, drawSpectrum.stateR]].forEach(([data, offsetX, state]) => {
        for (let i = 0; i < barCount; i++) {
            let sum = 0;
            const start = Math.floor(i * step);
            const end = Math.max(start + 1, Math.floor((i + 1) * step));
            for (let j = start; j < end; j++) sum += data[j] || 0;
            const val = sum / (end - start);
            const activeLeds = Math.round((val / 255) * ledCount);
            const x = offsetX + i * (barW + barGap);

            if (activeLeds >= state.peaks[i]) {
                state.peaks[i] = activeLeds;
                state.timers[i] = 45;
            } else if (state.timers[i] > 0) {
                state.timers[i]--;
            } else {
                state.peaks[i] = Math.max(0, state.peaks[i] - 1);
            }

            const peakLed = state.peaks[i];

            for (let l = 0; l < ledCount; l++) {
                const y = H - (l + 1) * ledStep;
                if (l === peakLed && peakLed > 0) {
                    spectrumCtx.fillStyle = 'rgba(255,60,34,0.9)';
                } else if (l < activeLeds) {
                    spectrumCtx.fillStyle = 'rgba(255,255,255,0.9)';
                } else {
                    spectrumCtx.fillStyle = '#111';
                }
                spectrumCtx.fillRect(x, y, barW, ledH);
            }
        }
    });
}

function getRMS(timeDomainData) {
    let sum = 0;
    for (let i = 0; i < timeDomainData.length; i++) {
        const val = (timeDomainData[i] - 128) / 128;
        sum += val * val;
    }
    return Math.sqrt(sum / timeDomainData.length);
}

function drawVu() {
    if (!analyser || vuAnimationRunning) return;
    vuAnimationRunning = true;

    const timeDomain = new Uint8Array(analyser.fftSize);

    function update() {
        if (isVuActive && !audio.paused && !audio.muted && playlist.length > 0) {
            if (isSpectrumMode) {
                const specDataL2 = new Uint8Array(spectrumAnalyserL ? spectrumAnalyserL.frequencyBinCount : analyser.frequencyBinCount);
                const specDataR2 = new Uint8Array(spectrumAnalyserR ? spectrumAnalyserR.frequencyBinCount : analyser.frequencyBinCount);
                if (spectrumAnalyserL) spectrumAnalyserL.getByteFrequencyData(specDataL2);
                else analyser.getByteFrequencyData(specDataL2);
                if (spectrumAnalyserR) spectrumAnalyserR.getByteFrequencyData(specDataR2);
                else analyser.getByteFrequencyData(specDataR2);
                drawSpectrum(specDataL2, specDataR2);
            } else if (isAnalogMode) {
                drawAnalogVu(!audio.paused && !audio.muted);
            } else {
                analyser.getByteTimeDomainData(timeDomain);
                const rms = getRMS(timeDomain);
                const expanded = Math.pow(rms * vuSensitivity, 0.55);
                const level = Math.min(100, expanded * 140);
                const levelR = Math.min(100, Math.pow(rms * vuSensitivity * (0.9 + Math.random() * 0.15), 0.55) * 140);

                if (level >= peakL) { peakL = level; peakTimerL = 25; }
                else if (peakTimerL > 0) { peakTimerL--; }
                else { peakL = Math.max(0, peakL - 1.5); }

                if (levelR >= peakR) { peakR = levelR; peakTimerR = 25; }
                else if (peakTimerR > 0) { peakTimerR--; }
                else { peakR = Math.max(0, peakR - 1.5); }

                updateVuBars(level, peakL, 'vuLBar');
                updateVuBars(levelR, peakR, 'vuRBar');
            }
        } else {
            peakL = 0; peakR = 0; peakTimerL = 0; peakTimerR = 0;
            updateVuBars(0, 0, 'vuLBar');
            updateVuBars(0, 0, 'vuRBar');
            if (isSpectrumMode) {
                const zeros = new Uint8Array(spectrumAnalyserL ? spectrumAnalyserL.frequencyBinCount : 128);
                drawSpectrum(zeros, zeros);
            }
            if (isAnalogMode) drawAnalogVu(false);
        }
        requestAnimationFrame(update);
    }
    update();
}

function loadTrack(index, autoPlay = true) {
    if (playlist.length === 0) return;
    currentIndex = index;
    const file = playlist[index];
    document.getElementById('format').innerText = file.name.split('.').pop().toUpperCase();
    const ti = (index + 1).toString().padStart(2, '0');
    const tl = playlist.length.toString().padStart(2, '0');
    document.getElementById('trackCounter').innerHTML =
        'TRACK&nbsp;' +
        ti.split('').map(c => `<span class="digit">${c}</span>`).join('') +
        `&nbsp<span class="sep">/</span>&nbsp` +
        tl.split('').map(c => `<span class="digit">${c}</span>`).join('');

    function applyTrackMeta(title, artist, album, coverUrl) {
        document.getElementById('trackTitle').innerText = title;
        document.getElementById('trackArtist').innerText = artist;
        document.getElementById('trackAlbum').innerText = album;
        const art = document.getElementById('albumArt');
        if (coverUrl) {
            art.style.backgroundImage = `url(${coverUrl})`;
            art.innerHTML = "";
        } else {
            art.style.backgroundImage = "none";
            art.innerHTML = '<i class="fa-solid fa-compact-disc"></i>';
        }
        updateArtworkBackground(coverUrl);
        updateMediaSession(title, artist, album, coverUrl || '');
    }

    if (metaCache.has(file) && coverCache.has(file)) {
        // Tags ET cover déjà en mémoire : affichage immédiat
        const cachedCover = coverCache.get(file);
        const tmp = document.createElement('div');
        tmp.innerHTML = metaCache.get(file);
        const spans = tmp.querySelectorAll('span');
        const title = spans[0] ? spans[0].textContent.replace('TITLE: ', '') : file.name.toUpperCase();
        const artist = spans[1] ? spans[1].textContent.replace('ARTIST: ', '') : 'UNKNOWN ARTIST';
        const album = spans[2] ? spans[2].textContent.replace('ALBUM: ', '') : 'UNKNOWN ALBUM';
        applyTrackMeta(title, artist, album, cachedCover);
    } else if (_hydrateFromPersisted(file)) {
        // Tags en localStorage, cover absente : afficher le texte immédiatement
        // puis relire jsmediatags uniquement pour la cover
        const tmp = document.createElement('div');
        tmp.innerHTML = metaCache.get(file);
        const spans = tmp.querySelectorAll('span');
        const title = spans[0] ? spans[0].textContent.replace('TITLE: ', '') : file.name.toUpperCase();
        const artist = spans[1] ? spans[1].textContent.replace('ARTIST: ', '') : 'UNKNOWN ARTIST';
        const album = spans[2] ? spans[2].textContent.replace('ALBUM: ', '') : 'UNKNOWN ALBUM';
        applyTrackMeta(title, artist, album, null);
        jsmediatags.read(file, {
            onSuccess: (tag) => {
                const coverUrl = extractCover(tag.tags);
                coverCache.set(file, coverUrl);
                applyTrackMeta(title, artist, album, coverUrl);
            },
            onError: () => { coverCache.set(file, null); }
        });
    } else {
        jsmediatags.read(file, {
            onSuccess: (tag) => {
                const t = tag.tags;
                const title = (t.title || file.name).toUpperCase();
                const artist = (t.artist || 'UNKNOWN ARTIST').toUpperCase();
                const album = (t.album || 'UNKNOWN ALBUM').toUpperCase();
                const coverUrl = extractCover(t);

                const html = '<span class="pl-title">TITLE: ' + title + '</span>'
                    + '<span class="pl-artist">ARTIST: ' + artist + '</span>'
                    + (album ? '<span class="pl-album">ALBUM: ' + album + '</span>' : '');
                metaCache.set(file, html);
                coverCache.set(file, coverUrl);
                _persistMeta(file, title, artist, album);
                applyTrackMeta(title, artist, album, coverUrl);
            },
            onError: () => {
                const title = file.name.toUpperCase();
                metaCache.set(file, '<span class="pl-title">' + title + '</span>');
                coverCache.set(file, null);
                _persistMeta(file, title, 'UNKNOWN ARTIST', '');
                applyTrackMeta(title, 'UNKNOWN ARTIST', 'UNKNOWN ALBUM', null);
            }
        });
    }

    if (audio.dataset.objectUrl) {
        URL.revokeObjectURL(audio.dataset.objectUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    audio.src = objectUrl;
    audio.dataset.objectUrl = objectUrl;

    // durationCache : écoute loadedmetadata une seule fois pour persister la durée
    audio.addEventListener('loadedmetadata', function _onMeta() {
        audio.removeEventListener('loadedmetadata', _onMeta);
        if (isFinite(audio.duration) && audio.duration > 0) {
            durationCache.set(file, audio.duration);
        }
    });

    decodeWaveform(file);
    setupMediaSessionActions();

    if (autoPlay) {
        initAudioContext();
        audio.play().then(() => {
            if (isVuActive) vuContainer.classList.add('active');
            playStateInd.textContent = 'PLAY';
            playStateInd.style.display = 'block';
            updatePlayBtn();
        });
    }

    if (playlistMenu.classList.contains('active')) {
        renderPlaylistMini();
    }
}

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length === 0) return;
    addFiles(Array.from(e.target.files));
});

const dropZone = document.getElementById('mainScreen');

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});
dropZone.addEventListener('dragleave', (e) => {
    if (!dropZone.contains(e.relatedTarget)) dropZone.classList.remove('drag-over');
});
dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('audio/'));
    if (files.length > 0) addFiles(files);
});

function addFiles(files) {
    const wasEmpty = playlist.length === 0;
    const startIndex = playlist.length;
    playlist = [...playlist, ...files];
    document.querySelectorAll('.media-ctrl').forEach(btn => btn.classList.add('ui-on'));
    document.getElementById('albumArt').style.opacity = "1";
    document.getElementById('timeCounter').classList.add('visible');
    document.getElementById('trackCounter').classList.add('visible');
    standbyLogo.style.display = "none";

    updateVolumeIndicator();
    updateToneIndicators();

    if (wasEmpty) {
        loadTrack(startIndex, true);
        setTimeout(() => schedulePrefetch(files.slice(1)), 500);
    } else {
        renderPlaylistMini();
        updateStatus('+ ' + files.length + ' TRACK' + (files.length > 1 ? 'S' : '') + ' ADDED');
        schedulePrefetch(files);
    }
}

const nextBtn = document.getElementById('nextBtn');
const prevBtn = document.getElementById('prevBtn');

function playNext() {
    if (playlist.length === 0) return;
    if (isShuffle) { loadTrack(Math.floor(Math.random() * playlist.length)); }
    else { currentIndex = (currentIndex + 1) % playlist.length; loadTrack(currentIndex); }
}

function playPrevious() {
    if (playlist.length === 0) return;
    if (audio.currentTime > 3) {
        audio.currentTime = 0;
        return;
    }
    currentIndex = (currentIndex - 1 + playlist.length) % playlist.length;
    loadTrack(currentIndex);
}

nextBtn.addEventListener('click', () => {
    if (!audio.src) return;
    playNext();
});

prevBtn.addEventListener('click', () => {
    if (!audio.src) return;
    playPrevious();
});

nextBtn.addEventListener('mousedown', () => {
    if (!audio.src) return;
    let isLongPress = false;
    const timer = setTimeout(() => {
        isLongPress = true;
        seekInterval = setInterval(() => {
            audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
            updateStatus("SEEK >>");
        }, 100);
    }, 500);
    const up = (e) => {
        clearTimeout(timer); clearInterval(seekInterval);
        if (isLongPress) {
            e.stopPropagation(); // Bloque l'événement click si c'était un appui long
        }
        window.removeEventListener('mouseup', up, true);
    };
    window.addEventListener('mouseup', up, true);
});

prevBtn.addEventListener('mousedown', () => {
    if (!audio.src) return;
    let isLongPress = false;
    const timer = setTimeout(() => {
        isLongPress = true;
        seekInterval = setInterval(() => {
            audio.currentTime = Math.max(0, audio.currentTime - 5);
            updateStatus("<< SEEK");
        }, 100);
    }, 500);
    const up = (e) => {
        clearTimeout(timer); clearInterval(seekInterval);
        if (isLongPress) {
            e.stopPropagation();
        }
        window.removeEventListener('mouseup', up, true);
    };
    window.addEventListener('mouseup', up, true);
});


const volUpBtn = document.getElementById('volUpBtn');
const volDownBtn = document.getElementById('volDownBtn');

function startVolumeChange(val) {
    volInterval = setInterval(() => {
        audio.volume = Math.min(1, Math.max(0, audio.volume + val));
        updateVolumeIndicator();
    }, 50);
}
function stopVolumeChange() { clearInterval(volInterval); updateVolumeIndicator(); savePreferences(); }

volUpBtn.addEventListener('mousedown', () => startVolumeChange(0.01));
volUpBtn.addEventListener('mouseup', stopVolumeChange);
volDownBtn.addEventListener('mousedown', () => startVolumeChange(-0.01));
volDownBtn.addEventListener('mouseup', stopVolumeChange);

function togglePlay() {
    if (!audio.src) return;
    initAudioContext();
    if (audio.paused) {
        audio.play().then(() => {
            if (isVuActive) vuContainer.classList.add('active');
            updatePlayBtn();
        }).catch(() => {
            updatePlayBtn();
        });
    } else {
        audio.pause();
        updatePlayBtn();
    }
}

function updatePlayBtn() {
    const icon = document.getElementById('playBtn').querySelector('i');
    const label = document.getElementById('playBtnLabel');
    const playing = !audio.paused;
    icon.className = playing ? 'fa-solid fa-pause' : 'fa-solid fa-play';
    label.textContent = playing ? 'PAUSE' : 'PLAY';
    if (playing && audio.src) {
        playStateInd.textContent = 'PLAY';
        playStateInd.style.display = 'block';
    } else if (!playing && audio.src && audio.currentTime > 0) {
        playStateInd.textContent = 'PAUSE';
        playStateInd.style.display = 'block';
    } else {
        playStateInd.style.display = 'none';
    }

    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = playing ? "playing" : "paused";
    }
}

function stopAudio() {
    audio.pause();
    audio.currentTime = 0;
    if (isVuActive && playlist.length > 0) vuContainer.classList.add('active');
    playStateInd.textContent = 'STOP';
    playStateInd.style.display = 'block';
    const icon = document.getElementById('playBtn').querySelector('i');
    const label = document.getElementById('playBtnLabel');
    icon.className = 'fa-solid fa-play';
    label.textContent = 'PLAY';

    if ('mediaSession' in navigator) {
        navigator.mediaSession.playbackState = "paused";
        // Optionnel : Vide l'affichage système lors d'un vrai STOP
        navigator.mediaSession.metadata = null; 
    }
}
audio.onended = () => {
    if (repeatMode === 1) { audio.play(); }
    else if (repeatMode === 2 || currentIndex < playlist.length - 1) { playNext(); }
    else {
        // Dernier morceau terminé : passer le bouton en STOP
        audio.pause();
        audio.currentTime = 0;
        const icon = document.getElementById('playBtn').querySelector('i');
        const label = document.getElementById('playBtnLabel');
        icon.className = 'fa-solid fa-play';
        label.textContent = 'PLAY';
        playStateInd.textContent = 'STOP';
        playStateInd.style.display = 'block';
        if ('mediaSession' in navigator) {
            navigator.mediaSession.playbackState = "paused";
        }
    }
};

function toggleShuffle() { isShuffle = !isShuffle; document.getElementById('shuffleBtn').classList.toggle('active', isShuffle); }
function cycleRepeat() {
    repeatMode = (repeatMode + 1) % 3;
    document.getElementById('rep1').classList.toggle('visible', repeatMode === 1);
    document.getElementById('repAll').classList.toggle('visible', repeatMode === 2);
    document.getElementById('repeatBtn').classList.toggle('active', repeatMode > 0);
}

function toggleMute() { audio.muted = !audio.muted; muteInd.style.display = audio.muted ? 'block' : 'none'; document.getElementById('muteBtn').classList.toggle('active', audio.muted); }

function toggleTone() {
    const active = toneMenu.classList.contains('active');
    hideAllMenus();
    if (!active) { toneMenu.classList.add('active'); document.getElementById('toneBtn').classList.add('active'); initAudioContext(); }
}

function toggleSettings() {
    const active = settingsMenu.classList.contains('active');
    hideAllMenus();
    if (!active) { settingsMenu.classList.add('active'); document.getElementById('settingsBtn').classList.add('active'); }
}

function togglePlaylist() {
    const active = playlistMenu.classList.contains('active');
    hideAllMenus();
    if (!active) { renderPlaylistMini(); playlistMenu.classList.add('active'); document.getElementById('playlistBtn').classList.add('active'); }
}

const metaCache = new Map();
const coverCache = new Map();

// ── Cache persistant (localStorage) ─────────────────────────────────────────
// Clé : "filename|size" — les covers ne sont PAS persistées (trop lourdes en base64)
const _META_STORE  = 'technics_metaCache_v1';
const _DUR_STORE   = 'technics_durationCache_v1';

let _pMeta = {};
let _pDur  = {};
try { _pMeta = JSON.parse(localStorage.getItem(_META_STORE)  || '{}'); } catch(e) {}
try { _pDur  = JSON.parse(localStorage.getItem(_DUR_STORE)   || '{}'); } catch(e) {}

function _cacheKey(file) { return file.name + '|' + file.size; }

// Tente de pré-hydrater metaCache depuis le localStorage ; retourne true si trouvé
function _hydrateFromPersisted(file) {
    if (metaCache.has(file)) return true;
    const p = _pMeta[_cacheKey(file)];
    if (!p) return false;
    const html = '<span class="pl-title">TITLE: ' + p.title + '</span>'
        + '<span class="pl-artist">ARTIST: ' + p.artist + '</span>'
        + (p.album ? '<span class="pl-album">ALBUM: ' + p.album + '</span>' : '');
    metaCache.set(file, html);
    // coverCache intentionnellement laissé vide — sera rempli par jsmediatags
    return true;
}

function _persistMeta(file, title, artist, album) {
    _pMeta[_cacheKey(file)] = { title, artist, album };
    try { localStorage.setItem(_META_STORE, JSON.stringify(_pMeta)); } catch(e) {}
}

// durationCache persistant
const durationCache = {
    get(file) { return _pDur[_cacheKey(file)] ?? null; },
    set(file, dur) {
        _pDur[_cacheKey(file)] = dur;
        try { localStorage.setItem(_DUR_STORE, JSON.stringify(_pDur)); } catch(e) {}
    }
};

function extractCover(t) {
    if (!t.picture) return null;
    const { data, format } = t.picture;
    let b64 = '';
    const chunk = 8192;
    for (let i = 0; i < data.length; i += chunk) {
        b64 += String.fromCharCode.apply(null, data.slice(i, i + chunk));
    }
    
    // Sécurité pour le type MIME
    let mimeType = format;
    if (!mimeType.includes('/')) {
        mimeType = `image/${format}`; // Transforme "jpeg" en "image/jpeg"
    }
    
    return `data:${mimeType};base64,${window.btoa(b64)}`;
}

let prefetchQueue = [];
let prefetchRunning = false;

function prefetchNext() {
    while (prefetchQueue.length > 0 && (metaCache.has(prefetchQueue[0]) || _hydrateFromPersisted(prefetchQueue[0]))) {
        prefetchQueue.shift();
    }
    if (prefetchQueue.length === 0) { prefetchRunning = false; return; }
    prefetchRunning = true;
    const file = prefetchQueue.shift();
    setTimeout(() => {
        jsmediatags.read(file, {
            onSuccess: (tag) => {
                const t = tag.tags;
                const title = (t.title || file.name).toUpperCase();
                const artist = (t.artist || 'UNKNOWN ARTIST').toUpperCase();
                const album = (t.album || '').toUpperCase();
                const html = '<span class="pl-title">TITLE: ' + title + '</span>'
                    + '<span class="pl-artist">ARTIST: ' + artist + '</span>'
                    + (album ? '<span class="pl-album">ALBUM: ' + album + '</span>' : '');
                metaCache.set(file, html);
                _persistMeta(file, title, artist, album);
                const coverUrl = extractCover(t);
                coverCache.set(file, coverUrl);
                prefetchNext();
            },
            onError: () => {
                const title = file.name.toUpperCase();
                metaCache.set(file, '<span class="pl-title">' + title + '</span>');
                _persistMeta(file, title, 'UNKNOWN ARTIST', '');
                coverCache.set(file, null);
                prefetchNext();
            }
        });
    }, 120);
}

function schedulePrefetch(files) {
    prefetchQueue.push(...files.filter(f => !metaCache.has(f) && !_hydrateFromPersisted(f)));
    if (!prefetchRunning) prefetchNext();
}

function getTrackLabel(file, textEl, imgEl) {
    if (metaCache.has(file) && coverCache.has(file)) {
        // Tags ET cover en mémoire
        textEl.innerHTML = metaCache.get(file);
        if (imgEl) {
            const url = coverCache.get(file);
            if (url) { imgEl.src = url; imgEl.style.display = 'block'; }
        }
        return;
    }
    if (_hydrateFromPersisted(file) || metaCache.has(file)) {
        // Tags en cache (localStorage ou mémoire), cover absente
        textEl.innerHTML = metaCache.get(file);
        if (imgEl) {
            // Relire jsmediatags uniquement pour la cover
            jsmediatags.read(file, {
                onSuccess: (tag) => {
                    const coverUrl = extractCover(tag.tags);
                    coverCache.set(file, coverUrl);
                    if (coverUrl) { imgEl.src = coverUrl; imgEl.style.display = 'block'; }
                },
                onError: () => { coverCache.set(file, null); }
            });
        } else {
            coverCache.set(file, null);
        }
        return;
    }
    textEl.innerHTML = '<span class="pl-title">LOADING...</span>';
    jsmediatags.read(file, {
        onSuccess: (tag) => {
            const t = tag.tags;
            const title = (t.title || file.name).toUpperCase();
            const artist = (t.artist || 'UNKNOWN ARTIST').toUpperCase();
            const album = (t.album || '').toUpperCase();
            const html = '<span class="pl-title">TITLE: ' + title + '</span>'
                + '<span class="pl-artist">ARTIST: ' + artist + '</span>'
                + (album ? '<span class="pl-album">ALBUM: ' + album + '</span>' : '');
            metaCache.set(file, html);
            _persistMeta(file, title, artist, album);
            textEl.innerHTML = html;

            const coverUrl = extractCover(t);
            coverCache.set(file, coverUrl);
            if (imgEl && coverUrl) { imgEl.src = coverUrl; imgEl.style.display = 'block'; }
        },
        onError: () => {
            const title = file.name.toUpperCase();
            const html = '<span class="pl-title">' + title + '</span>';
            metaCache.set(file, html);
            _persistMeta(file, title, 'UNKNOWN ARTIST', '');
            coverCache.set(file, null);
            textEl.innerHTML = html;
        }
    });
}

function renderPlaylistMini(forceRebuild = false) {
    const container = document.getElementById('playlistContainerMini');
    const existingItems = container.querySelectorAll('.playlist-item-mini');

    if (!forceRebuild && existingItems.length === playlist.length) {
        existingItems.forEach((item, i) => {
            item.classList.toggle('active', i === currentIndex);
        });
        return;
    }

    container.innerHTML = "";

    playlist.forEach((file, index) => {
        const item = document.createElement('div');
        item.className = `playlist-item-mini ${index === currentIndex ? 'active' : ''}`;

        const text = document.createElement('div');
        text.className = 'playlist-item-text';

        const thumb = document.createElement('img');
        thumb.className = 'pl-thumb';
        thumb.style.display = 'none';

        const removeBtn = document.createElement('button');
        removeBtn.className = 'playlist-remove-btn';
        removeBtn.innerHTML = '&times;';

        removeBtn.onclick = (e) => {
            e.stopPropagation();
            const wasPlaying = !audio.paused;
            const removedCurrent = index === currentIndex;
            metaCache.delete(playlist[index]);
            coverCache.delete(playlist[index]);
            playlist.splice(index, 1);

            if (playlist.length === 0) {
                audio.pause();
                audio.src = "";
                container.innerHTML = "";
                if ('mediaSession' in navigator) navigator.mediaSession.playbackState = "none";
                return;
            }

            if (index < currentIndex) {
                currentIndex--;
            }

            if (removedCurrent) {
                if (currentIndex >= playlist.length) {
                    currentIndex = 0;
                }
                loadTrack(currentIndex, wasPlaying);
            } else {
                renderPlaylistMini();
            }
        };

        getTrackLabel(file, text, thumb);

        item.onclick = () => {
            loadTrack(index, true);
            // Mise à jour du surlignage sans reconstruire le DOM
            container.querySelectorAll('.playlist-item-mini').forEach((el, i) => {
                el.classList.toggle('active', i === index);
            });
        };

        const dragHandle = document.createElement('span');
        dragHandle.className = 'pl-drag-handle';
        dragHandle.innerHTML = '<i class="fa-solid fa-grip-lines"></i>';
        dragHandle.draggable = false; // seul le item est draggable

        item.appendChild(dragHandle);
        item.appendChild(removeBtn);
        item.appendChild(thumb);
        item.appendChild(text);

        item.dataset.index = index;
        item.draggable = true;
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', item.dataset.index);
            setTimeout(() => item.classList.add('dragging'), 0);
        });
        item.addEventListener('dragend', () => {
            item.classList.remove('dragging');
            container.querySelectorAll('.playlist-item-mini').forEach(el => {
                el.classList.remove('drag-over-top', 'drag-over-bottom');
            });
        });
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const rect = item.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            container.querySelectorAll('.playlist-item-mini').forEach(el => {
                el.classList.remove('drag-over-top', 'drag-over-bottom');
            });
            item.classList.add(e.clientY < mid ? 'drag-over-top' : 'drag-over-bottom');
        });
        item.addEventListener('dragleave', (e) => {
            if (!item.contains(e.relatedTarget)) {
                item.classList.remove('drag-over-top', 'drag-over-bottom');
            }
        });
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            item.classList.remove('drag-over-top', 'drag-over-bottom');
            const fromIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const toItemIndex = parseInt(item.dataset.index);
            const rect = item.getBoundingClientRect();
            const mid = rect.top + rect.height / 2;
            const insertAfter = e.clientY >= mid;

            let insertAt = insertAfter ? toItemIndex + 1 : toItemIndex;

            if (fromIndex === toItemIndex) return;

            const moved = playlist.splice(fromIndex, 1)[0];

            if (fromIndex < insertAt) insertAt--;
            playlist.splice(insertAt, 0, moved);

            if (currentIndex === fromIndex) {
                currentIndex = insertAt;
            } else if (fromIndex < currentIndex && insertAt >= currentIndex) {
                currentIndex--;
            } else if (fromIndex > currentIndex && insertAt <= currentIndex) {
                currentIndex++;
            }
            renderPlaylistMini(true);
        });
        container.appendChild(item);
    });
}

// ── WAVEFORM ──────────────────────────────────────────────────────────────
let waveformEnabled = true;
let waveformData = null;
const waveformCanvas = document.getElementById('waveformCanvas');
const waveformCtx = waveformCanvas ? waveformCanvas.getContext('2d') : null;

function toggleWaveform() {
    waveformEnabled = !waveformEnabled;
    const btn = document.getElementById('waveformToggleBtn');
    if (btn) { btn.textContent = waveformEnabled ? 'ON' : 'OFF'; btn.classList.toggle('active', waveformEnabled); }
    if (!waveformEnabled && waveformCtx) {
        waveformCtx.clearRect(0, 0, waveformCanvas.width, waveformCanvas.height);
    } else if (waveformEnabled && waveformData) {
        drawWaveform();
    }
    savePreferences();
}

function decodeWaveform(file) {
    if (!waveformEnabled) return;
    waveformData = null;
    const reader = new FileReader();
    reader.onload = (e) => {
        const offlineCtx = new OfflineAudioContext(1, 1, 44100);
        offlineCtx.decodeAudioData(e.target.result.slice(0), (buffer) => {
            const raw = buffer.getChannelData(0);
            const points = 700;
            const step = Math.floor(raw.length / points);
            const data = new Float32Array(points);
            for (let i = 0; i < points; i++) {
                let max = 0;
                for (let j = 0; j < step; j++) {
                    const v = Math.abs(raw[i * step + j] || 0);
                    if (v > max) max = v;
                }
                data[i] = max;
            }
            waveformData = data;
            drawWaveform();
        }, () => { });
    };
    reader.readAsArrayBuffer(file);
}

function drawWaveform() {
    if (!waveformCtx || !waveformData || !waveformEnabled) return;
    const W = waveformCanvas.offsetWidth || waveformCanvas.width;
    const H = waveformCanvas.offsetHeight || waveformCanvas.height;
    if (waveformCanvas.width !== W) waveformCanvas.width = W;
    if (waveformCanvas.height !== H) waveformCanvas.height = H;
    waveformCtx.clearRect(0, 0, W, H);

    const points = waveformData.length;
    const barW = W / points;

    for (let i = 0; i < points; i++) {
        const amp = waveformData[i];
        const barH = Math.max(1, amp * H);
        const y = (H - barH) / 2;
        const progress = audio.duration ? audio.currentTime / audio.duration : 0;
        const played = (i / points) <= progress;
        waveformCtx.fillStyle = played ? 'rgba(255,255,255,0.9)' : 'rgba(180,180,180,0.4)';
        waveformCtx.fillRect(i * barW, y, Math.max(1, barW - 0.5), barH);
    }
}

audio.addEventListener('timeupdate', () => {
    if (waveformEnabled && waveformData) drawWaveform();
});

function hideAllMenus() {
    [toneMenu, settingsMenu, playlistMenu].forEach(m => m.classList.remove('active'));
    [document.getElementById('toneBtn'), document.getElementById('settingsBtn'), document.getElementById('playlistBtn')].forEach(b => b.classList.remove('active'));
}

audio.ontimeupdate = () => {
    const p = audio.duration ? (audio.currentTime / audio.duration) * 100 : 0;
    progressBar.style.width = p + "%";
    const cur = formatTime(audio.currentTime);
    const dur = formatTime(audio.duration || 0);
    document.getElementById('timeCounter').innerHTML = 'TIME ' + cur + ' ' + sep('/') + ' ' + dur;
};

function digit(c) { return `<span class="digit">${c}</span>`; }
function sep(c) { return `<span class="sep">${c}</span>`; }
function formatTime(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    const ms = m.toString().padStart(2, '0');
    const ss = s.toString().padStart(2, '0');
    return digit(ms[0]) + digit(ms[1]) + sep(':') + digit(ss[0]) + digit(ss[1]);
}

document.getElementById('progressContainer').onclick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const p = (e.clientX - rect.left) / rect.width;
    audio.currentTime = p * audio.duration;
};

window.onload = () => {
    loadPreferences();
    setVuMode(isSpectrumMode ? 'spectrum' : 'vumeter');
    ['rock', 'pop', 'jazz', 'classic', 'live', 'flat'].forEach(name => {
        const btn = document.getElementById('dspBtn_' + name);
        if (btn) btn.classList.toggle('active', name === currentDspPreset);
    });
    const ind = document.getElementById('dspIndicator');
    if (ind && currentDspPreset !== 'flat') {
        ind.textContent = 'DSP ' + currentDspPreset.toUpperCase();
        ind.style.display = 'block';
    }

    const wBtn = document.getElementById('waveformToggleBtn');
    if (wBtn) { wBtn.textContent = waveformEnabled ? 'ON' : 'OFF'; wBtn.classList.toggle('active', waveformEnabled); }
};

window.addEventListener('resize', () => {
    if (waveformEnabled && waveformData) drawWaveform();
});

window.addEventListener('beforeunload', (e) => {
    if (!audio.paused) {
        e.preventDefault();
        e.returnValue = '';
    }
});
document.addEventListener('DOMContentLoaded', updateEjectAnimation);

function updateMediaSession(title, artist, album, coverUrl = '') {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.metadata = new MediaMetadata({
        title: title || "Unknown title",
        artist: artist || "Unknown artist",
        album: album || "Unknown album",
        artwork: coverUrl ? [
            { src: coverUrl, sizes: '512x512', type: 'image/png' }
        ] : []
    });
}

function updatePlaybackPosition() {
    if (!('mediaSession' in navigator)) return;
    if (!navigator.mediaSession.setPositionState) return;
    if (!isFinite(audio.duration) || audio.duration <= 0) return;

    try {
        navigator.mediaSession.setPositionState({
            duration: audio.duration,
            playbackRate: audio.playbackRate || 1,
            position: Math.min(audio.currentTime || 0, audio.duration)
        });
    } catch (e) { }
}

function setupMediaSessionActions() {
    if (!('mediaSession' in navigator)) return;

    navigator.mediaSession.setActionHandler('play', () => {
        audio.play();
        updatePlayBtn();
    });

    navigator.mediaSession.setActionHandler('pause', () => {
        audio.pause();
        updatePlayBtn();
    });

    navigator.mediaSession.setActionHandler('previoustrack', () => {
        playPrevious();
    });

    navigator.mediaSession.setActionHandler('nexttrack', () => {
        playNext();
    });

    navigator.mediaSession.setActionHandler('seekforward', (details) => {
        audio.currentTime = Math.min(
            audio.currentTime + (details.seekOffset || 10),
            audio.duration || Infinity
        );
        updatePlaybackPosition();
    });

    navigator.mediaSession.setActionHandler('seekbackward', (details) => {
        audio.currentTime = Math.max(
            audio.currentTime - (details.seekOffset || 10),
            0
        );
        updatePlaybackPosition();
    });

    navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime !== undefined) {
            audio.currentTime = details.seekTime;
            updatePlaybackPosition();
        }
    });
}

if ('mediaSession' in navigator) {
    setupMediaSessionActions();
}

audio.addEventListener('timeupdate', updatePlaybackPosition);
audio.addEventListener('play', updatePlaybackPosition);
audio.addEventListener('pause', updatePlaybackPosition);
