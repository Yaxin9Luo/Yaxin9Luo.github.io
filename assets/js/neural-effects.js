/**
 * Neural Network Particle Effects for AI Researcher Homepage
 * Creates dynamic, interactive visual elements
 */

class NeuralNetwork {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.connections = [];
        this.mouse = { x: null, y: null, radius: 150 };
        this.animationId = null;
        
        this.init();
    }
    
    init() {
        this.createCanvas();
        this.createParticles();
        this.bindEvents();
        this.animate();
    }
    
    createCanvas() {
        // Create canvas element
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'neural-network-bg';
        this.canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: -1;
            pointer-events: none;
            opacity: 0.6;
        `;
        
        document.body.insertBefore(this.canvas, document.body.firstChild);
        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();
    }
    
    resizeCanvas() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    createParticles() {
        const particleCount = Math.min(80, window.innerWidth / 20);
        this.particles = [];
        
        for (let i = 0; i < particleCount; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                radius: Math.random() * 3 + 1,
                opacity: Math.random() * 0.5 + 0.2,
                pulsePhase: Math.random() * Math.PI * 2
            });
        }
    }
    
    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        this.updateParticles();
        this.drawConnections();
        this.drawParticles();
        
        this.animationId = requestAnimationFrame(() => this.animate());
    }
    
    updateParticles() {
        this.particles.forEach(particle => {
            // Update position
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            // Bounce off edges
            if (particle.x < 0 || particle.x > this.canvas.width) {
                particle.vx *= -1;
            }
            if (particle.y < 0 || particle.y > this.canvas.height) {
                particle.vy *= -1;
            }
            
            // Update pulse phase
            particle.pulsePhase += 0.02;
            
            // Mouse interaction
            if (this.mouse.x !== null) {
                const dx = this.mouse.x - particle.x;
                const dy = this.mouse.y - particle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < this.mouse.radius) {
                    const force = (this.mouse.radius - distance) / this.mouse.radius;
                    particle.x += dx * force * 0.01;
                    particle.y += dy * force * 0.01;
                }
            }
        });
    }
    
    drawParticles() {
        this.particles.forEach(particle => {
            const pulse = Math.sin(particle.pulsePhase) * 0.5 + 0.5;
            const currentRadius = particle.radius + pulse * 2;
            const currentOpacity = particle.opacity + pulse * 0.3;
            
            // Gradient for particle
            const gradient = this.ctx.createRadialGradient(
                particle.x, particle.y, 0,
                particle.x, particle.y, currentRadius
            );
            gradient.addColorStop(0, `rgba(74, 144, 226, ${currentOpacity})`);
            gradient.addColorStop(0.5, `rgba(108, 92, 231, ${currentOpacity * 0.6})`);
            gradient.addColorStop(1, `rgba(0, 217, 255, 0)`);
            
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, currentRadius, 0, Math.PI * 2);
            this.ctx.fillStyle = gradient;
            this.ctx.fill();
        });
    }
    
    drawConnections() {
        for (let i = 0; i < this.particles.length; i++) {
            for (let j = i + 1; j < this.particles.length; j++) {
                const dx = this.particles[i].x - this.particles[j].x;
                const dy = this.particles[i].y - this.particles[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 120) {
                    const opacity = (120 - distance) / 120 * 0.3;
                    
                    // Create gradient line
                    const gradient = this.ctx.createLinearGradient(
                        this.particles[i].x, this.particles[i].y,
                        this.particles[j].x, this.particles[j].y
                    );
                    gradient.addColorStop(0, `rgba(74, 144, 226, ${opacity})`);
                    gradient.addColorStop(0.5, `rgba(108, 92, 231, ${opacity * 0.8})`);
                    gradient.addColorStop(1, `rgba(0, 217, 255, ${opacity})`);
                    
                    this.ctx.beginPath();
                    this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
                    this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
                    this.ctx.strokeStyle = gradient;
                    this.ctx.lineWidth = 1;
                    this.ctx.stroke();
                }
            }
        }
    }
    
    bindEvents() {
        window.addEventListener('resize', () => {
            this.resizeCanvas();
            this.createParticles();
        });
        
        document.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });
        
        document.addEventListener('mouseleave', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });
    }
    
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}

// Enhanced typing animation for research interests
class TypingAnimation {
    constructor(element, texts, typeSpeed = 100, deleteSpeed = 50, pauseTime = 2000) {
        this.element = element;
        this.texts = texts;
        this.typeSpeed = typeSpeed;
        this.deleteSpeed = deleteSpeed;
        this.pauseTime = pauseTime;
        this.currentTextIndex = 0;
        this.currentCharIndex = 0;
        this.isDeleting = false;
        this.init();
    }
    
    init() {
        if (this.element) {
            this.type();
        }
    }
    
    type() {
        const currentText = this.texts[this.currentTextIndex];
        
        if (!this.isDeleting) {
            // Typing
            this.element.textContent = currentText.substring(0, this.currentCharIndex + 1);
            this.currentCharIndex++;
            
            if (this.currentCharIndex === currentText.length) {
                // Finished typing, wait then start deleting
                setTimeout(() => {
                    this.isDeleting = true;
                    this.type();
                }, this.pauseTime);
                return;
            }
        } else {
            // Deleting
            this.element.textContent = currentText.substring(0, this.currentCharIndex - 1);
            this.currentCharIndex--;
            
            if (this.currentCharIndex === 0) {
                // Finished deleting, move to next text
                this.isDeleting = false;
                this.currentTextIndex = (this.currentTextIndex + 1) % this.texts.length;
            }
        }
        
        const speed = this.isDeleting ? this.deleteSpeed : this.typeSpeed;
        setTimeout(() => this.type(), speed);
    }
}

// Parallax scrolling effect
class ParallaxEffect {
    constructor() {
        this.elements = document.querySelectorAll('[data-parallax]');
        this.init();
    }
    
    init() {
        if (this.elements.length > 0) {
            window.addEventListener('scroll', () => this.updateParallax());
        }
    }
    
    updateParallax() {
        const scrollTop = window.pageYOffset;
        
        this.elements.forEach(element => {
            const speed = element.dataset.parallax || 0.5;
            const yPos = -(scrollTop * speed);
            element.style.transform = `translate3d(0, ${yPos}px, 0)`;
        });
    }
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Neural network background
    const neuralNetwork = new NeuralNetwork();
    
    // Typing animation for bio or research interests
    const bioElement = document.querySelector('.author__bio');
    if (bioElement && bioElement.textContent) {
        const originalText = bioElement.textContent;
        const researchAreas = [
            "🧠 Multimodal Foundation Models",
            "🤖 World Models & Embodied AI",
            "⚡ Efficient Model Training",
            "🔬 Data-centric ML Research",
            "🌐 Neural Architecture Search"
        ];
        
        bioElement.innerHTML = `<span class="typing-text">${originalText}</span> <span class="cursor">|</span>`;
        
        // Add typing cursor style
        const style = document.createElement('style');
        style.textContent = `
            .cursor {
                animation: blink 1s infinite;
                color: #4A90E2;
                font-weight: bold;
            }
            @keyframes blink {
                0%, 50% { opacity: 1; }
                51%, 100% { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
    }
    
    // Parallax effects
    new ParallaxEffect();
    
    // Add scroll reveal animations
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };
    
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
            }
        });
    }, observerOptions);
    
    // Observe elements for scroll reveal
    document.querySelectorAll('.publication-card, .research-section, h2, h3').forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
        observer.observe(el);
    });
    
    // Add loading animation
    document.body.classList.add('loading-pulse');
    setTimeout(() => {
        document.body.classList.remove('loading-pulse');
    }, 1000);
    
    // Cleanup on page unload
    window.addEventListener('beforeunload', () => {
        neuralNetwork.destroy();
    });
});

// Export for potential external use
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { NeuralNetwork, TypingAnimation, ParallaxEffect };
}