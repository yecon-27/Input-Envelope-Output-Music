// Lightweight sound synthesizer: plays sound effects on hit, supports multiple instrument timbres
(function () {
    class PopSynth {
      constructor() {
        this.ctx = new (window.AudioContext || window.webkitAudioContext)();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.7; // Global volume
        this.master.connect(this.ctx.destination);
        this.startedAt = this.ctx.currentTime;
        
        // Timbre settings: 'piano' | 'epiano' | 'guitar'
        // Legacy value compatibility: 'soft' -> 'piano', 'bright' -> 'piano'
        this.timbre = 'piano';
      }
      
      now() { return this.ctx.currentTime; }
      resume() { if (this.ctx.state !== 'running') return this.ctx.resume(); }
      
      setVolume(volume) {
        // Set master volume, volume should be between 0-1
        this.master.gain.value = Math.max(0, Math.min(1, volume));
      }
      
      /**
       * Set timbre
       * @param {string} timbre
       */
      setTimbre(timbre) {
        if (timbre === 'soft') timbre = 'piano';
        if (timbre === 'bright') timbre = 'piano'; // Legacy value compatibility, changed to piano
        
        const validTimbres = ['piano', 'epiano', 'guitar'];
        if (validTimbres.includes(timbre)) {
            this.timbre = timbre;
        } else {
            this.timbre = 'piano';
        }
        console.log('🎵 Instant feedback timbre switch:', this.timbre);
      }
  
      play(freq, { when = this.now(), vel = 0.9, dur = 0.22 } = {}) {
        switch (this.timbre) {
            case 'epiano':
                this._playEPiano(freq, { when, vel, dur });
                break;
            case 'guitar':
                this._playGuitar(freq, { when, vel, dur });
                break;
            case 'piano':
            default:
                this._playPiano(freq, { when, vel, dur });
                break;
        }
      }
      
      /**
       * Piano timbre (formerly Soft) - dual sine wave, warm
       */
      _playPiano(freq, { when, vel, dur }) {
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const g = this.ctx.createGain();
  
        osc1.type = 'sine';
        osc2.type = 'triangle'; // Mix in some triangle wave for texture
        osc1.frequency.setValueAtTime(freq, when);
        osc2.frequency.setValueAtTime(freq * 1.005, when);
  
        // Envelope: fast attack + natural decay
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(vel * 0.8, when + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, when + dur + 0.1);
  
        // Mix ratio
        const mix = this.ctx.createGain();
        mix.gain.value = 0.8; 
        
        osc1.connect(g);
        osc2.connect(mix); mix.connect(g);
        g.connect(this.master);
  
        osc1.start(when); osc2.start(when);
        const stopAt = when + dur + 0.2;
        osc1.stop(stopAt); osc2.stop(stopAt);
      }

      /**
       * Electric Piano timbre (Rhodes-ish) - FM synthesis
       */
      _playEPiano(freq, { when, vel, dur }) {
        const carrier = this.ctx.createOscillator();
        const modulator = this.ctx.createOscillator();
        const modGain = this.ctx.createGain();
        const masterGain = this.ctx.createGain();

        carrier.type = 'sine';
        carrier.frequency.setValueAtTime(freq, when);

        modulator.type = 'sine';
        modulator.frequency.setValueAtTime(freq * 4, when); // Modulation frequency ratio

        // Modulation index envelope
        modGain.gain.setValueAtTime(freq * 0.5, when); // Initial modulation depth
        modGain.gain.exponentialRampToValueAtTime(1, when + dur); // Reduce modulation over time, sound becomes purer

        // Amplitude envelope
        masterGain.gain.setValueAtTime(0, when);
        masterGain.gain.linearRampToValueAtTime(vel * 0.7, when + 0.02);
        masterGain.gain.exponentialRampToValueAtTime(0.001, when + dur + 0.3);

        modulator.connect(modGain);
        modGain.connect(carrier.frequency);
        carrier.connect(masterGain);
        masterGain.connect(this.master);

        carrier.start(when);
        modulator.start(when);
        const stopAt = when + dur + 0.4;
        carrier.stop(stopAt);
        modulator.stop(stopAt);
      }

      /**
       * Guitar timbre (Nylon) - plucked feel, fast decay
       */
      _playGuitar(freq, { when, vel, dur }) {
        const osc = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, when);

        // Low-pass filter simulates nylon string warmth
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 3, when);
        filter.Q.value = 0.5;

        // Plucked envelope: very fast attack, exponential decay
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(vel, when + 0.005);
        g.gain.exponentialRampToValueAtTime(0.001, when + Math.min(dur, 0.4)); // Guitar single note decays faster

        osc.connect(filter);
        filter.connect(g);
        g.connect(this.master);

        osc.start(when);
        const stopAt = when + dur + 0.1;
        osc.stop(stopAt);
      }
      
      /**
       * Strings timbre - slow attack, sawtooth wave
       */
      _playStrings(freq, { when, vel, dur }) {
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const g = this.ctx.createGain();
        const filter = this.ctx.createBiquadFilter();
        
        osc1.type = 'sawtooth';
        osc1.frequency.setValueAtTime(freq, when);
        
        osc2.type = 'sawtooth';
        osc2.frequency.setValueAtTime(freq * 1.003, when); // Detuned chorus effect
        
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq * 2, when);
        
        // Strings envelope: slow attack (Legato)
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(vel * 0.5, when + 0.1); 
        g.gain.setValueAtTime(vel * 0.4, when + dur * 0.5);
        g.gain.linearRampToValueAtTime(0, when + dur + 0.2); // Slow release
        
        osc1.connect(filter);
        osc2.connect(filter);
        filter.connect(g);
        g.connect(this.master);
        
        osc1.start(when); osc2.start(when);
        const stopAt = when + dur + 0.3;
        osc1.stop(stopAt); osc2.stop(stopAt);
      }
    }
  
    window.PopSynth = PopSynth;
  })();
