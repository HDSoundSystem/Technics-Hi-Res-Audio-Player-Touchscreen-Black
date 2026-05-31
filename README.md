# Technics High Resolution Audio Player Touch Edition
<img width="1855" height="737" alt="1" src="https://github.com/user-attachments/assets/ed5331fe-d526-4792-a778-0fc9525351a1" />

---

# 🎧 Technics High Resolution Audio Player (Touch Edition)

A web-based progressive audio player (PWA) that emulates the interface, ergonomics, and aesthetics of vintage High-Fidelity hardware. This player integrates advanced audio signal processing via the **Web Audio API** and features high-performance, real-time dynamic visualizers.

<img width="1846" height="725" alt="2" src="https://github.com/user-attachments/assets/fafb78d2-1beb-449c-9401-d0f371bc15ea" />

---

## 🚀 Key Features

### 🎛️ Audio Processing & Equalization (Web Audio API)

* **Tone Control Equalizer:** Dynamic frequency adjustments using shelf filters (*BiquadFilterNode*):
  * **BASS:** Low-shelf filter (`lowshelf`) centered at $100\text{ Hz}$ (Range: $-12\text{ dB}$ to $+12\text{ dB}$).
  * **TREBLE:** High-shelf filter (`highshelf`) centered at $3000\text{ Hz}$ (Range: $-12\text{ dB}$ to $+12\text{ dB}$).

* **5-Band DSP Presets:** Six one-click equalization presets applied via dedicated `BiquadFilterNode` nodes:

  | Preset  | Bass (100 Hz) | Mid (400 Hz) | Mid (1 kHz) | Presence (3.5 kHz) | Air (8 kHz) |
  |---------|:---:|:---:|:---:|:---:|:---:|
  | FLAT    |  0  |  0  |  0  |  0  |  0  |
  | ROCK    | +6  | −3  |  0  | +4  | +3  |
  | POP     | +3  | +1  | +3  | +3  | +2  |
  | JAZZ    | +4  | −2  | +3  | +2  |  0  |
  | CLASSIC |  0  |  0  | −2  | +2  | +4  |
  | LIVE    | −2  | +3  | +2  | +5  | +2  |

  Preset bass boost is additive with the manual BASS tone control. Re-clicking an active preset resets to FLAT.

* **Loudness Correction:** Active physiological compensation for bass and treble frequencies during low-volume listening (Automatic boost of $+8\text{ dB}$ for bass at $200\text{ Hz}$ and $+4\text{ dB}$ for treble at $10\text{ kHz}$).

  <img width="1865" height="738" alt="4" src="https://github.com/user-attachments/assets/e64a920a-3748-4b67-8efb-78d3e7c37e3b" />

### 📊 Graphical Visualizers

The system embeds a dual, switchable spectral analysis module (`AnalyserNode`, `fftSize` 1024):

* **VU Meters Mode:** Dual hardware-style level indicators (Left Channel / Right Channel) calculated using the true Root Mean Square (**RMS**) of the signal, featuring fine sensitivity scaling ($10\%$ to $450\%$) and peak hold functionality.
* **Spectrum Analyzer Mode:** A matrix LED bar display ($22$ frequency bands per channel) rendered in real-time onto an HTML5 `<canvas>` element.
* **Waveform Display:** An offline-decoded waveform overview rendered on a dedicated `<canvas>`, synchronized with playback progress. Can be toggled ON/OFF from the settings panel.

  <img width="1886" height="740" alt="3" src="https://github.com/user-attachments/assets/1adf261f-b153-4f8a-b479-26fc76485d6c" />

### 🗂️ Playlist Management & Metadata Parsing

* **Hybrid Import:** Load audio files via the native file selector or by dropping them directly anywhere onto the main screen using **Drag & Drop**.
* **ID3 Tag Parsing:** Integrated `jsmediatags` library to seamlessly extract and display:
  * Track title, artist name, and album title (automatically formatted in uppercase).
  * Embedded album artwork converted on-the-fly to a Base64 data URL.

* **Background Metadata Prefetch:** After loading the first track, the player queues remaining tracks for background metadata extraction via a sequential prefetch scheduler, eliminating any loading latency on track change.
* **Interactive Mini-Playlist:** A side menu drawer to view the current queue, switch instantly to any track, or remove a track with automatic playlist index recalculation.

<img width="1855" height="737" alt="7" src="https://github.com/user-attachments/assets/523e29c2-edf9-40fb-b236-ce9525665716" />

### 🕹️ Hardware-Style Control Ergonomics

* **Unified Playback State Indicator:** A single on-screen indicator replaces its current text dynamically — displaying **PLAY**, **PAUSE**, or **STOP** — at the same fixed position on the screen.
* **Progress Bar Seek:** Click anywhere on the progress bar to instantly seek to that position in the current track.
* **Continuous Volume Adjustment:** Volume control buttons (`#volUpBtn` / `#volDownBtn`) respond to a mouse hold (`mousedown`), smoothly adjusting the gain level every $50\text{ ms}$.
* **Hybrid Navigation Buttons (Click vs. Long Press):**
  * *Short Click:* Instantly skips to the next track (`playNext()`) or previous track (`playPrevious()`).
  * *Long Press (>500ms):* Triggers fast-forward or rewind (**SEEK >> / << SEEK** in $5\text{-second}$ increments) for as long as the button is held down, preventing accidental track skipping upon release.

* **Playback Modes:** Supports **Shuffle Play** and a 3-state **Repeat** cycle (No repeat, Repeat Current Track, Repeat Entire Playlist).

### 🖥️ System Integration & Persistence

* **Media Session API:** Native OS-level integration for keyboard media keys, system lock screen widget controls, and metadata/artwork broadcasting (compatible with Windows, macOS, Android, and iOS). Supports `seekforward` and `seekbackward` actions.
* **State Persistence:** Saves user preferences to `localStorage` upon any change: volume level, filter gains, DSP preset, VU meter sensitivity, waveform toggle, Loudness toggle state, and custom application background color.
* **Custom Background Color:** A color picker in the settings panel allows the user to set a custom application background color, saved to `localStorage`.
* **Page Exit Guardrail:** Implements a preventive warning (`beforeunload`) if the user attempts to close or reload the tab while audio playback is active.
* **Power/Restart Button:** A dedicated power button triggers a confirmation modal before reloading the application session.

---

<img width="1850" height="725" alt="6" src="https://github.com/user-attachments/assets/4dab82ec-b80e-4206-9285-01c6283af1cf" />

## 🛠️ Audio Signal Routing Architecture

The `Web Audio API` routing graph is structured as follows within the application:

```
[Audio Element Source]
         │
         ▼
[Loudness Bass Filter]    (Lowshelf @200Hz, +8dB when active)
         │
         ▼
[Loudness Treble Filter]  (Highshelf @10kHz, +4dB when active)
         │
         ▼
[Bass Tone Filter]        (Lowshelf @100Hz, ±12dB)
         │
         ▼
[Treble Tone Filter]      (Highshelf @3kHz, ±12dB)
         │
         ▼
[DSP Mid Filter]          (Peaking @400Hz, Q=1.0)
         │
         ▼
[DSP Mid2 Filter]         (Peaking @1kHz, Q=1.2)
         │
         ▼
[DSP Presence Filter]     (Peaking @3.5kHz, Q=1.0)
         │
         ▼
[DSP Air Filter] ─────────┬────> [Channel Splitter (2 Ch)]
         │                │              │
         ▼                │              ├──> [Spectrum Analyser L]
[Master Analyser]         │              └──> [Spectrum Analyser R]
         │                │                   (VU Meter RMS / LED Bars)
         ▼                └─> (Offline Waveform Decode via OfflineAudioContext)
[Audio Context Destination (Speakers)]
```

---

<img width="1856" height="746" alt="5" src="https://github.com/user-attachments/assets/e72dfd4b-b2e1-4d69-9bb5-3ed3c78503ba" />

## 💾 Installation & Requirements

This application is completely standalone and runs entirely client-side (Vanilla JS).

1. Clone or download the HTML, CSS, and JavaScript files into your local directory.
2. Ensure you include the metadata parser dependency in your HTML header:

```html
<script src="https://cdnjs.cloudflare.com/ajax/libs/jsmediatags/3.9.5/jsmediatags.min.js"></script>
```

3. Run the project using a local development server (e.g., *Live Server* extension in VS Code) to prevent CORS issues when instantiating the `AudioContext` and processing local files.

<img width="1850" height="733" alt="8" src="https://github.com/user-attachments/assets/effdc7ae-61a2-4db8-aef6-cb9d590b5602" />
