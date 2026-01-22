/**
 * Diverse Music Generator
 * Generates varied music based on game session data using world music scales
 */

class UltraDiverseMusicGenerator {
    constructor() {
        this.randomState = {
            seed: Date.now(),
            current: Date.now()
        };
        
        // Scale definitions (semitone intervals from root)
        this.scales = {
            // Western scales
            major: [0, 2, 4, 5, 7, 9, 11],
            minor: [0, 2, 3, 5, 7, 8, 10],
            harmonic_minor: [0, 2, 3, 5, 7, 8, 11],
            melodic_minor: [0, 2, 3, 5, 7, 9, 11],
            // Church modes
            dorian: [0, 2, 3, 5, 7, 9, 10],
            phrygian: [0, 1, 3, 5, 7, 8, 10],
            lydian: [0, 2, 4, 6, 7, 9, 11],
            mixolydian: [0, 2, 4, 5, 7, 9, 10],
            locrian: [0, 1, 3, 5, 6, 8, 10],
            // Pentatonic variants
            pentatonic: [0, 2, 4, 7, 9],
            pentatonic_minor: [0, 3, 5, 7, 10],
            egyptian: [0, 2, 5, 7, 10],
            hirajoshi: [0, 2, 3, 7, 8],
            // Blues and jazz scales
            blues: [0, 3, 5, 6, 7, 10],
            blues_major: [0, 2, 3, 4, 7, 9],
            bebop_dominant: [0, 2, 4, 5, 7, 9, 10, 11],
            bebop_major: [0, 2, 4, 5, 7, 8, 9, 11],
            // Exotic scales
            arabic: [0, 1, 4, 5, 7, 8, 11],
            persian: [0, 1, 4, 5, 6, 8, 11],
            hungarian: [0, 2, 3, 6, 7, 8, 11],
            gypsy: [0, 1, 4, 5, 7, 8, 10],
            spanish: [0, 1, 4, 5, 7, 8, 10],
            // Modern/experimental scales
            whole_tone: [0, 2, 4, 6, 8, 10],
            diminished: [0, 2, 3, 5, 6, 8, 9, 11],
            augmented: [0, 3, 4, 7, 8, 11],
            prometheus: [0, 2, 4, 6, 9, 10],
            // Asian scales
            chinese: [0, 2, 4, 7, 9],
            japanese_in: [0, 1, 5, 7, 8],
            japanese_yo: [0, 2, 5, 7, 10],
            balinese: [0, 1, 3, 7, 8],
            // Indian ragas
            raga_bhairav: [0, 1, 4, 5, 7, 8, 11],
            raga_yaman: [0, 2, 4, 6, 7, 9, 11],
            raga_kafi: [0, 2, 3, 5, 7, 9, 10],
            // African scales
            african_pentatonic: [0, 2, 3, 7, 9],
            ethiopian: [0, 2, 4, 5, 7, 8, 11],
            // Latin American scales
            flamenco: [0, 1, 4, 5, 7, 8, 11],
            brazilian: [0, 2, 4, 6, 7, 9, 10],
            // Chromatic
            quarter_tone_major: [0, 1, 2, 4, 5, 7, 8, 9, 11],
            chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
        };
        
        // Chord progressions by genre
        this.chordProgressions = {
            pop: [
                [0, 5, 6, 4], [0, 4, 5, 0], [6, 4, 0, 5], [0, 6, 4, 5], [4, 5, 6, 4]
            ],
            jazz: [
                [0, 6, 2, 5], [0, 3, 6, 2, 5], [6, 2, 5, 0], [0, 1, 2, 5], [2, 5, 0, 6]
            ],
            classical: [
                [0, 4, 0, 5, 0], [0, 2, 5, 0], [0, 6, 4, 5], [0, 3, 4, 5, 0], [0, 5, 6, 3, 4, 0]
            ],
            ambient: [
                [0, 2, 4, 6], [0, 7, 4, 2], [6, 0, 4, 2], [4, 0, 5, 2], [0, 3, 6, 2]
            ],
            cinematic: [
                [0, 3, 6, 4, 5], [6, 3, 4, 0], [0, 2, 6, 5], [4, 6, 0, 5], [0, 1, 4, 3]
            ],
            blues: [
                [0, 0, 0, 0, 3, 3, 0, 0, 4, 3, 0, 4], [0, 3, 0, 4], [0, 6, 3, 4]
            ],
            rock: [
                [0, 6, 3, 4], [0, 2, 3, 0], [5, 3, 0, 4], [0, 4, 5, 3], [6, 3, 0, 4]
            ],
            folk: [
                [0, 3, 4, 0], [0, 5, 3, 4], [6, 3, 0, 4], [0, 2, 3, 0], [0, 6, 3, 0]
            ],
            latin: [
                [0, 4, 5, 0], [6, 2, 5, 0], [0, 3, 6, 4], [2, 5, 0, 6], [0, 1, 4, 5]
            ],
            world: [
                [0, 2, 4, 5], [0, 6, 2, 4], [5, 0, 3, 4], [0, 3, 5, 2], [4, 0, 6, 2]
            ],
            modern: [
                [0, 1, 2, 3], [0, 4, 8, 0], [0, 3, 6, 9], [0, 2, 5, 7], [6, 10, 2, 5]
            ],
            electronic: [
                [0, 4, 6, 2], [6, 0, 4, 2], [0, 2, 4, 6], [4, 6, 0, 2], [0, 5, 3, 6]
            ],
            game: [
                [0, 4, 5, 3], [6, 2, 4, 0], [0, 6, 2, 5], [4, 0, 6, 3], [0, 3, 4, 6]
            ]
        };
        
        // Rhythm patterns
        this.rhythmPatterns = {
            // Basic
            steady: [1, 0, 1, 0, 1, 0, 1, 0],
            simple: [1, 0, 0, 0, 1, 0, 0, 0],
            march: [1, 0, 1, 0, 1, 0, 1, 0],
            // Syncopated
            syncopated: [1, 0, 0, 1, 0, 1, 0, 0],
            offbeat: [0, 1, 0, 1, 0, 1, 0, 1],
            polyrhythm: [1, 0, 1, 1, 0, 1, 0, 1],
            // Triple meter
            waltz: [1, 0, 0, 1, 0, 0],
            minuet: [1, 0, 1, 1, 0, 1],
            mazurka: [1, 0, 1, 0, 1, 0],
            // Latin
            latin: [1, 0, 1, 0, 0, 1, 0, 1],
            samba: [1, 0, 0, 1, 0, 1, 1, 0],
            bossa_nova: [1, 0, 0, 1, 0, 0, 1, 0],
            salsa: [1, 0, 1, 0, 1, 1, 0, 1],
            tango: [1, 0, 1, 1, 0, 1, 0, 0],
            // Jazz
            swing: [1, 0, 0, 1, 0, 0, 1, 0],
            bebop: [1, 0, 1, 0, 1, 1, 0, 1],
            cool_jazz: [1, 0, 0, 0, 1, 0, 1, 0],
            fusion: [1, 1, 0, 1, 0, 1, 1, 0],
            // Rock
            rock: [1, 0, 1, 0, 1, 0, 1, 0],
            punk: [1, 1, 1, 1, 1, 1, 1, 1],
            metal: [1, 0, 1, 1, 0, 1, 1, 0],
            progressive: [1, 0, 1, 0, 0, 1, 0, 1, 1, 0],
            // Electronic
            house: [1, 0, 0, 0, 1, 0, 0, 0],
            techno: [1, 0, 1, 0, 1, 0, 1, 0],
            trance: [1, 0, 0, 1, 0, 0, 1, 0],
            dubstep: [1, 0, 0, 0, 1, 1, 0, 1],
            drum_and_bass: [1, 0, 1, 1, 0, 1, 0, 1],
            // World
            african: [1, 0, 1, 1, 0, 1, 0, 1],
            indian_tala: [1, 0, 0, 1, 0, 1, 0, 0, 1, 0],
            middle_eastern: [1, 0, 1, 0, 0, 1, 1, 0],
            celtic: [1, 0, 1, 1, 0, 1],
            flamenco: [1, 0, 0, 1, 0, 1, 1, 0, 1, 0, 0, 1],
            // Complex
            complex: [1, 0, 1, 0, 0, 1, 0, 1, 0, 0],
            irregular: [1, 0, 1, 0, 0, 1, 1, 0, 1],
            polymetric: [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1],
            // Ambient
            ambient: [1, 0, 0, 0, 1, 0, 0, 0],
            drone: [1, 0, 0, 0, 0, 0, 0, 0],
            minimal: [1, 0, 0, 0, 0, 1, 0, 0],
            meditative: [1, 0, 0, 0, 0, 0, 1, 0],
            // High energy
            energetic: [1, 1, 0, 1, 1, 0, 1, 0],
            frantic: [1, 1, 1, 0, 1, 1, 0, 1],
            driving: [1, 0, 1, 1, 1, 0, 1, 1],
            explosive: [1, 1, 1, 1, 0, 1, 1, 1],
        };
        
        // Instrument definitions (MIDI program numbers)
        this.instruments = {
            // Keyboards
            piano: { program: 0, channel: 0, name: 'Acoustic Grand Piano' },
            epiano: { program: 4, channel: 1, name: 'Electric Piano' },
            harpsichord: { program: 6, channel: 2, name: 'Harpsichord' },
            // Organs
            organ: { program: 16, channel: 3, name: 'Hammond Organ' },
            church_organ: { program: 19, channel: 4, name: 'Church Organ' },
            // Guitars
            guitar: { program: 24, channel: 5, name: 'Acoustic Guitar' },
            eguitar_clean: { program: 27, channel: 6, name: 'Electric Guitar Clean' },
            eguitar_distortion: { program: 29, channel: 7, name: 'Electric Guitar Distortion' },
            // Bass
            bass: { program: 32, channel: 8, name: 'Acoustic Bass' },
            ebass: { program: 33, channel: 9, name: 'Electric Bass' },
            synth_bass: { program: 38, channel: 10, name: 'Synth Bass' },
            // Strings
            violin: { program: 40, channel: 11, name: 'Violin' },
            viola: { program: 41, channel: 12, name: 'Viola' },
            cello: { program: 42, channel: 13, name: 'Cello' },
            strings: { program: 48, channel: 14, name: 'String Ensemble' },
            // Winds
            flute: { program: 73, channel: 15, name: 'Flute' },
            oboe: { program: 68, channel: 16, name: 'Oboe' },
            clarinet: { program: 71, channel: 17, name: 'Clarinet' },
            saxophone: { program: 64, channel: 18, name: 'Soprano Sax' },
            trumpet: { program: 56, channel: 19, name: 'Trumpet' },
            trombone: { program: 57, channel: 20, name: 'Trombone' },
            // Synths
            synth_lead: { program: 80, channel: 21, name: 'Synth Lead Square' },
            synth_saw: { program: 81, channel: 22, name: 'Synth Lead Sawtooth' },
            synth_pad: { program: 88, channel: 23, name: 'Synth Pad New Age' },
            synth_choir: { program: 91, channel: 24, name: 'Synth Choir' },
            // Specialty
            harp: { program: 46, channel: 25, name: 'Harp' },
            xylophone: { program: 13, channel: 26, name: 'Xylophone' },
            marimba: { program: 12, channel: 27, name: 'Marimba' },
            music_box: { program: 10, channel: 28, name: 'Music Box' },
            // Ethnic
            sitar: { program: 104, channel: 29, name: 'Sitar' },
            banjo: { program: 105, channel: 30, name: 'Banjo' },
            shamisen: { program: 106, channel: 31, name: 'Shamisen' }
        };
        
        // Style templates by performance level
        this.styleTemplates = [
            // Very high performance (30+ bubbles/min)
            {
                name: 'cyber_punk_2077',
                conditions: { performance: [30, 100] },
                scale: ['hungarian', 'diminished', 'chromatic'],
                progression: ['electronic', 'modern'],
                rhythm: ['dubstep', 'frantic', 'explosive'],
                tempo: [150, 180],
                instruments: [['synth_saw', 'synth_bass', 'eguitar_distortion'], ['synth_lead', 'synth_pad']],
                complexity: 'extreme'
            },
            {
                name: 'speed_metal_fury',
                conditions: { performance: [30, 100] },
                scale: ['phrygian', 'locrian', 'harmonic_minor'],
                progression: ['rock', 'modern'],
                rhythm: ['metal', 'progressive', 'driving'],
                tempo: [160, 200],
                instruments: [['eguitar_distortion', 'ebass', 'synth_lead'], ['organ', 'trombone']],
                complexity: 'extreme'
            },
            // High performance (20-30 bubbles/min)
            {
                name: 'progressive_odyssey',
                conditions: { performance: [20, 30] },
                scale: ['lydian', 'bebop_major', 'whole_tone'],
                progression: ['jazz', 'classical', 'modern'],
                rhythm: ['progressive', 'polyrhythm', 'complex'],
                tempo: [120, 150],
                instruments: [['epiano', 'saxophone', 'synth_bass'], ['strings', 'trumpet']],
                complexity: 'high'
            },
            {
                name: 'latin_fire_dance',
                conditions: { performance: [20, 30] },
                scale: ['spanish', 'flamenco', 'gypsy'],
                progression: ['latin', 'world'],
                rhythm: ['salsa', 'flamenco', 'tango'],
                tempo: [130, 160],
                instruments: [['trumpet', 'guitar', 'marimba'], ['violin', 'ebass']],
                complexity: 'high'
            },
            // Medium performance (10-20 bubbles/min)
            {
                name: 'indie_dreamscape',
                conditions: { performance: [10, 20] },
                scale: ['dorian', 'mixolydian', 'pentatonic'],
                progression: ['pop', 'folk', 'ambient'],
                rhythm: ['syncopated', 'offbeat', 'waltz'],
                tempo: [100, 130],
                instruments: [['eguitar_clean', 'piano', 'violin'], ['harp', 'flute']],
                complexity: 'medium'
            },
            {
                name: 'world_fusion_journey',
                conditions: { performance: [10, 20] },
                scale: ['arabic', 'raga_bhairav', 'balinese'],
                progression: ['world', 'ambient'],
                rhythm: ['middle_eastern', 'indian_tala', 'african'],
                tempo: [90, 120],
                instruments: [['sitar', 'flute', 'marimba'], ['strings', 'harp']],
                complexity: 'medium'
            },
            // Low performance (5-10 bubbles/min)
            {
                name: 'zen_garden',
                conditions: { performance: [5, 10] },
                scale: ['pentatonic', 'hirajoshi', 'chinese'],
                progression: ['ambient', 'world'],
                rhythm: ['meditative', 'minimal', 'drone'],
                tempo: [60, 90],
                instruments: [['shamisen', 'harp', 'synth_pad'], ['flute', 'music_box']],
                complexity: 'low'
            },
            {
                name: 'classical_elegance',
                conditions: { performance: [5, 10] },
                scale: ['major', 'harmonic_minor', 'dorian'],
                progression: ['classical', 'folk'],
                rhythm: ['waltz', 'minuet', 'simple'],
                tempo: [70, 100],
                instruments: [['piano', 'violin', 'cello'], ['harpsichord', 'oboe']],
                complexity: 'low'
            },
            // Very low performance (<5 bubbles/min)
            {
                name: 'cosmic_meditation',
                conditions: { performance: [0, 5] },
                scale: ['whole_tone', 'pentatonic_minor', 'prometheus'],
                progression: ['ambient', 'modern'],
                rhythm: ['drone', 'ambient', 'minimal'],
                tempo: [40, 70],
                instruments: [['synth_pad', 'synth_choir'], ['harp', 'music_box']],
                complexity: 'minimal'
            }
        ];
    }
    
    /**
     * Initialize random seed
     */
    initializeRandomSeed(seed) {
        this.randomState.seed = seed;
        this.randomState.current = seed;
    }
    
    /**
     * Generate reproducible random number (0-1)
     */
    seededRandom() {
        this.randomState.current = (this.randomState.current * 1664525 + 1013904223) % 4294967296;
        return this.randomState.current / 4294967296;
    }
    
    /**
     * Generate reproducible random integer
     */
    seededRandomInt(min, max) {
        return Math.floor(this.seededRandom() * (max - min + 1)) + min;
    }
    
    /**
     * Random selection from array
     */
    seededChoice(array) {
        return array[this.seededRandomInt(0, array.length - 1)];
    }
    
    /**
     * Generate diverse music based on game session
     */
    generateMusic(gameSession) {
        const bubbleCount = gameSession?.notes?.length || 0;
        const sessionDuration = gameSession?.durationSec || 60;
        
        // Generate unique seed from timestamp, game data, and random factor
        const randomFactor = Math.floor(Math.random() * 10000);
        const randomSeed = Date.now() + bubbleCount * 1000 + sessionDuration * 100 + randomFactor;
        this.initializeRandomSeed(randomSeed);
        
        console.log(`Music generation started - seed: ${randomSeed}`);
        
        // Analyze game data
        const gameAnalysis = this.analyzeGameSession(gameSession);
        console.log(`Game analysis complete:`, gameAnalysis);
        
        // Select style template
        const styleTemplate = this.selectStyleTemplate(gameAnalysis);
        console.log(`Selected style template: ${styleTemplate.name}`);
        
        // Generate music parameters
        const musicParams = this.generateMusicParameters(styleTemplate, gameAnalysis);
        console.log(`Music params:`, musicParams);
        
        // Generate music structure
        const musicStructure = this.createMusicStructure(musicParams, gameAnalysis);
        
        // Generate all notes
        const notes = this.generateAllNotes(musicStructure, gameAnalysis);
        
        // Create final sequence
        return this.createMusicSequence(notes, musicStructure, musicParams);
    }
    
    /**
     * Analyze game session data
     */
    analyzeGameSession(gameSession) {
        const bubbleCount = gameSession?.notes?.length || 0;
        const sessionDuration = gameSession?.durationSec || 60;
        const notes = gameSession?.notes || [];
        
        const performance = bubbleCount / (sessionDuration / 60);
        
        // Analyze rhythm characteristics
        const rhythmAnalysis = this.analyzeRhythm(notes);
        
        // Analyze pitch characteristics
        const pitchAnalysis = this.analyzePitch(notes);
        
        // Analyze timing distribution
        const timingAnalysis = this.analyzeTiming(notes, sessionDuration);
        
        return {
            bubbleCount,
            sessionDuration,
            performance,
            rhythm: rhythmAnalysis,
            pitch: pitchAnalysis,
            timing: timingAnalysis,
            energy: this.calculateEnergyLevel(rhythmAnalysis, performance),
            complexity: this.calculateComplexity(pitchAnalysis, rhythmAnalysis),
            mood: this.determineMood(performance, timingAnalysis)
        };
    }
    
    /**
     * Analyze rhythm patterns
     */
    analyzeRhythm(notes) {
        if (notes.length < 2) return { regularity: 0.5, avgInterval: 2000, variance: 1000 };
        
        const intervals = [];
        for (let i = 1; i < notes.length; i++) {
            intervals.push(notes[i].dt - notes[i-1].dt);
        }
        
        const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length;
        const variance = intervals.reduce((sum, interval) => sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length;
        const regularity = Math.max(0, 1 - (Math.sqrt(variance) / avgInterval));
        
        return { regularity, avgInterval, variance };
    }
    
    /**
     * Analyze pitch distribution
     */
    analyzePitch(notes) {
        if (notes.length === 0) return { range: 12, avgPitch: 60, distribution: 'even' };
        
        const pitches = notes.map(n => n.midi || 60);
        const minPitch = Math.min(...pitches);
        const maxPitch = Math.max(...pitches);
        const range = maxPitch - minPitch;
        const avgPitch = pitches.reduce((a, b) => a + b, 0) / pitches.length;
        
        const pitchCounts = {};
        pitches.forEach(pitch => {
            pitchCounts[pitch] = (pitchCounts[pitch] || 0) + 1;
        });
        
        const uniquePitches = Object.keys(pitchCounts).length;
        const distribution = uniquePitches / pitches.length > 0.7 ? 'scattered' : 
                           uniquePitches / pitches.length < 0.3 ? 'focused' : 'balanced';
        
        return { range, avgPitch, distribution, uniquePitches };
    }
    
    /**
     * Analyze timing distribution
     */
    analyzeTiming(notes, sessionDuration) {
        if (notes.length === 0) return { consistency: 0.5, acceleration: 0, density: 0 };
        
        const sessionMs = sessionDuration * 1000;
        const firstHalf = notes.filter(n => n.dt < sessionMs / 2).length;
        const secondHalf = notes.filter(n => n.dt >= sessionMs / 2).length;
        
        const acceleration = (secondHalf - firstHalf) / notes.length;
        const density = notes.length / sessionDuration;
        
        const timeSlots = 10;
        const slotSize = sessionMs / timeSlots;
        const slotCounts = new Array(timeSlots).fill(0);
        
        notes.forEach(note => {
            const slotIndex = Math.min(Math.floor(note.dt / slotSize), timeSlots - 1);
            slotCounts[slotIndex]++;
        });
        
        const avgPerSlot = notes.length / timeSlots;
        const variance = slotCounts.reduce((sum, count) => sum + Math.pow(count - avgPerSlot, 2), 0) / timeSlots;
        const consistency = Math.max(0, 1 - (Math.sqrt(variance) / avgPerSlot));
        
        return { consistency, acceleration, density };
    }
    
    /**
     * Calculate energy level
     */
    calculateEnergyLevel(rhythmAnalysis, performance) {
        const rhythmEnergy = 1 - rhythmAnalysis.regularity;
        const performanceEnergy = Math.min(1, performance / 30);
        return (rhythmEnergy + performanceEnergy) / 2;
    }
    
    /**
     * Calculate complexity
     */
    calculateComplexity(pitchAnalysis, rhythmAnalysis) {
        const pitchComplexity = Math.min(1, pitchAnalysis.range / 24);
        const rhythmComplexity = 1 - rhythmAnalysis.regularity;
        return (pitchComplexity + rhythmComplexity) / 2;
    }
    
    /**
     * Determine mood
     */
    determineMood(performance, timingAnalysis) {
        if (performance > 25 && timingAnalysis.acceleration > 0.2) return 'excited';
        if (performance > 15 && timingAnalysis.consistency > 0.7) return 'confident';
        if (performance < 5 && timingAnalysis.acceleration < -0.2) return 'relaxed';
        if (timingAnalysis.consistency < 0.3) return 'chaotic';
        return 'balanced';
    }
    
    /**
     * Select style template based on performance
     */
    selectStyleTemplate(gameAnalysis) {
        const { performance } = gameAnalysis;
        
        // Filter matching templates
        const matchingTemplates = this.styleTemplates.filter(template => {
            const [min, max] = template.conditions.performance;
            return performance >= min && performance < max;
        });
        
        // Use default template if no match
        if (matchingTemplates.length === 0) {
            return {
                name: 'universal_harmony',
                scale: ['major', 'pentatonic'],
                progression: ['pop', 'folk'],
                rhythm: ['steady', 'simple'],
                tempo: [90, 110],
                instruments: [['piano', 'violin', 'flute'], ['harp']],
                complexity: 'medium'
            };
        }
        
        // Randomly select a matching template
        return this.seededChoice(matchingTemplates);
    }
    
    /**
     * Generate music parameters
     */
    generateMusicParameters(styleTemplate, gameAnalysis) {
        return {
            name: styleTemplate.name,
            scale: this.seededChoice(styleTemplate.scale),
            progression: this.seededChoice(styleTemplate.progression),
            rhythm: this.seededChoice(styleTemplate.rhythm),
            tempo: this.seededRandomInt(styleTemplate.tempo[0], styleTemplate.tempo[1]),
            instruments: this.selectInstruments(styleTemplate.instruments),
            complexity: styleTemplate.complexity,
            key: this.selectKey()
        };
    }
    
    /**
     * Select key
     */
    selectKey() {
        const keys = [60, 62, 64, 65, 67, 69, 71]; // C, D, E, F, G, A, B
        return this.seededChoice(keys);
    }
    
    /**
     * Select instrument combination
     */
    selectInstruments(instrumentGroups) {
        const selectedInstruments = [];
        
        // Select from each instrument group
        instrumentGroups.forEach(group => {
            if (Array.isArray(group)) {
                // Randomly select 1-2 instruments from group
                const numToSelect = this.seededRandomInt(1, Math.min(2, group.length));
                const shuffled = [...group].sort(() => this.seededRandom() - 0.5);
                
                for (let i = 0; i < numToSelect; i++) {
                    if (this.instruments[shuffled[i]]) {
                        selectedInstruments.push(this.instruments[shuffled[i]]);
                    }
                }
            }
        });
        
        // Ensure at least one instrument
        if (selectedInstruments.length === 0) {
            selectedInstruments.push(this.instruments.piano);
        }
        
        return selectedInstruments;
    }
    
    /**
     * Create music structure
     */
    createMusicStructure(musicParams, gameAnalysis) {
        const targetDuration = Math.max(12, Math.min(45, gameAnalysis.sessionDuration * 0.8));
        
        return {
            params: musicParams,
            duration: targetDuration,
            sections: this.createSections(musicParams, targetDuration),
            scale: this.scales[musicParams.scale],
            chordProgression: this.seededChoice(this.chordProgressions[musicParams.progression]),
            rhythmPattern: this.rhythmPatterns[musicParams.rhythm],
            instruments: musicParams.instruments
        };
    }
    
    /**
     * Create music section structure
     */
    createSections(musicParams, duration) {
        const sections = [];
        let currentTime = 0;
        
        // Intro
        if (duration > 20) {
            sections.push({
                name: 'intro',
                start: currentTime,
                duration: 4,
                intensity: 0.3,
                instruments: musicParams.instruments.slice(0, 1)
            });
            currentTime += 4;
        }
        
        // Theme A
        const mainDuration = Math.min(8, duration * 0.4);
        sections.push({
            name: 'theme_a',
            start: currentTime,
            duration: mainDuration,
            intensity: 0.7,
            instruments: musicParams.instruments.slice(0, 2)
        });
        currentTime += mainDuration;
        
        // Development
        if (duration > 25) {
            sections.push({
                name: 'development',
                start: currentTime,
                duration: 6,
                intensity: 0.9,
                instruments: musicParams.instruments
            });
            currentTime += 6;
        }
        
        // Theme B
        const themeBDuration = Math.min(8, duration - currentTime - 4);
        if (themeBDuration > 0) {
            sections.push({
                name: 'theme_b',
                start: currentTime,
                duration: themeBDuration,
                intensity: 0.8,
                instruments: musicParams.instruments.slice(1)
            });
            currentTime += themeBDuration;
        }
        
        // Outro
        const outroDuration = duration - currentTime;
        if (outroDuration > 0) {
            sections.push({
                name: 'outro',
                start: currentTime,
                duration: outroDuration,
                intensity: 0.4,
                instruments: musicParams.instruments.slice(0, 1)
            });
        }
        
        return sections;
    }
    
    /**
     * Generate all notes
     */
    generateAllNotes(structure, gameAnalysis) {
        const notes = [];
        
        structure.sections.forEach(section => {
            notes.push(...this.generateSectionNotes(section, structure, gameAnalysis));
        });
        
        return notes;
    }
    
    /**
     * Generate notes for a specific section
     */
    generateSectionNotes(section, structure, gameAnalysis) {
        const notes = [];
        
        // Generate chords
        notes.push(...this.generateChords(section, structure));
        
        // Generate melody
        notes.push(...this.generateMelody(section, structure, gameAnalysis));
        
        // Generate bass line
        notes.push(...this.generateBassLine(section, structure));
        
        return notes;
    }
    
    /**
     * Generate chords
     */
    generateChords(section, structure) {
        const notes = [];
        const { start, duration } = section;
        const { params, scale, chordProgression, instruments } = structure;
        
        const chordInstrument = instruments.find(inst => 
            ['piano', 'epiano', 'organ', 'guitar'].some(type => 
                inst.name.toLowerCase().includes(type.toLowerCase())
            )
        ) || instruments[0];
        
        const chordDuration = 2;
        const numChords = Math.ceil(duration / chordDuration);
        
        for (let i = 0; i < numChords; i++) {
            const chordStart = start + i * chordDuration;
            const chordEnd = Math.min(chordStart + chordDuration * 0.9, start + duration);
            
            const chordIndex = chordProgression[i % chordProgression.length];
            const rootNote = params.key + scale[chordIndex % scale.length];
            
            // Generate triad
            const chordNotes = [
                rootNote,
                rootNote + scale[2 % scale.length],
                rootNote + scale[4 % scale.length]
            ];
            
            chordNotes.forEach((pitch, noteIndex) => {
                notes.push({
                    pitch: pitch,
                    startTime: chordStart + noteIndex * 0.05,
                    endTime: chordEnd,
                    velocity: Math.floor(50 + section.intensity * 30),
                    instrument: chordInstrument.channel,
                    program: chordInstrument.program
                });
            });
        }
        
        return notes;
    }
    
    /**
     * Generate melody
     */
    generateMelody(section, structure, gameAnalysis) {
        const notes = [];
        const { start, duration, intensity } = section;
        const { params, scale, rhythmPattern } = structure;
        
        const melodyInstrument = structure.instruments.find(inst => 
            ['violin', 'flute', 'clarinet', 'sax', 'synth'].some(type =>
                inst.name.toLowerCase().includes(type.toLowerCase())
            )
        ) || structure.instruments[1] || structure.instruments[0];
        
        const noteLength = 0.5;
        let currentTime = start;
        let rhythmIndex = 0;
        
        const melodyRange = Math.min(2, Math.max(0.5, gameAnalysis.pitch.range / 12));
        
        while (currentTime < start + duration) {
            const shouldPlay = rhythmPattern[rhythmIndex % rhythmPattern.length];
            
            if (shouldPlay) {
                const scaleIndex = this.seededRandomInt(0, scale.length - 1);
                const octaveVariation = this.seededRandomInt(-melodyRange, melodyRange);
                const pitch = params.key + scale[scaleIndex] + 12 + octaveVariation * 12;
                
                const rhythmFactor = gameAnalysis.rhythm.regularity;
                const lengthVariation = rhythmFactor > 0.7 ? 0.2 : 0.8;
                const noteDuration = noteLength * (0.5 + this.seededRandom() * lengthVariation);
                
                const energyBoost = gameAnalysis.energy * 30;
                const velocityVariation = this.seededRandomInt(-15, 15);
                
                notes.push({
                    pitch: Math.max(48, Math.min(96, pitch)),
                    startTime: currentTime,
                    endTime: currentTime + noteDuration,
                    velocity: Math.floor(60 + intensity * 40 + energyBoost + velocityVariation),
                    instrument: melodyInstrument.channel,
                    program: melodyInstrument.program
                });
            }
            
            currentTime += noteLength;
            rhythmIndex++;
        }
        
        return notes;
    }
    
    /**
     * Generate bass line
     */
    generateBassLine(section, structure) {
        const notes = [];
        const { start, duration } = section;
        const { params, scale, chordProgression } = structure;
        
        const bassInstrument = structure.instruments.find(inst => 
            ['bass', 'ebass', 'cello'].some(type =>
                inst.name.toLowerCase().includes(type.toLowerCase())
            )
        );
        
        if (!bassInstrument) return notes;
        
        const bassDuration = 1;
        let currentTime = start;
        let chordIndex = 0;
        
        while (currentTime < start + duration) {
            const chordRoot = chordProgression[chordIndex % chordProgression.length];
            const bassNote = params.key + scale[chordRoot % scale.length] - 24;
            
            notes.push({
                pitch: Math.max(24, bassNote),
                startTime: currentTime,
                endTime: currentTime + bassDuration * 0.8,
                velocity: Math.floor(60 + section.intensity * 20),
                instrument: bassInstrument.channel,
                program: bassInstrument.program
            });
            
            currentTime += bassDuration;
            chordIndex++;
        }
        
        return notes;
    }
    
    /**
     * Create final music sequence
     */
    createMusicSequence(notes, structure, musicParams) {
        notes.sort((a, b) => a.startTime - b.startTime);
        
        const totalTime = Math.max(...notes.map(n => n.endTime)) + 1;
        
        const instrumentInfos = structure.instruments.map(inst => ({
            instrument: inst.channel,
            program: inst.program,
            isDrum: false,
            name: inst.name
        }));
        
        return {
            ticksPerQuarter: 220,
            totalTime: totalTime,
            tempos: [{ time: 0, qpm: musicParams.tempo }],
            notes: notes,
            instrumentInfos: instrumentInfos,
            keySignatures: [{ time: 0, key: 0, scale: 0 }],
            timeSignatures: [{ time: 0, numerator: 4, denominator: 4 }],
            controlChanges: [],
            metadata: {
                style: musicParams.name,
                key: musicParams.key,
                scale: musicParams.scale,
                progression: musicParams.progression,
                rhythm: musicParams.rhythm,
                tempo: musicParams.tempo,
                complexity: musicParams.complexity,
                instrumentCount: instrumentInfos.length,
                noteCount: notes.length,
                generatedAt: new Date().toISOString(),
                seed: this.randomState.seed
            }
        };
    }
}

// Export to global
window.UltraDiverseMusicGenerator = UltraDiverseMusicGenerator;

// Create convenience function
window.createUltraDiverseMusic = function(gameSession) {
    const generator = new UltraDiverseMusicGenerator();
    return generator.generateMusic(gameSession);
};

console.log('Diverse music generator loaded');