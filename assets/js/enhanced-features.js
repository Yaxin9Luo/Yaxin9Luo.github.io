/* ==========================================================================
   ENHANCED INTERACTIVE FEATURES FOR YAXIN'S WEBSITE
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function() {
    const isHome = (location.pathname.replace(/\/+$/, '') === '');

    // Global niceties
    addFloatingContactButton();
    addScrollToTop();
    addSmoothScrolling();
    addThemeToggle();

    // Home-specific artistic features
    if (isHome) {
        addTypingAnimation();
        addSignatureUnderline();
        addMorphingBlobs();
        addOrbitingTopics();
        addPublicationFilmstrip();
        addParticleBackground();
    }
});

function addFloatingContactButton() {
    const floatingBtn = document.createElement('div');
    floatingBtn.className = 'floating-contact';
    floatingBtn.innerHTML = '<i class="fas fa-envelope"></i>';
    floatingBtn.setAttribute('title', 'Contact Yaxin');
    
    floatingBtn.addEventListener('click', function() {
        window.location.href = 'mailto:yaxinluo999@163.com';
    });
    
    document.body.appendChild(floatingBtn);
}

function addScrollToTop() {
    const scrollBtn = document.createElement('div');
    scrollBtn.className = 'scroll-to-top';
    scrollBtn.innerHTML = '<i class="fas fa-arrow-up"></i>';
    scrollBtn.style.cssText = `
        position: fixed;
        bottom: 100px;
        right: 30px;
        width: 50px;
        height: 50px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s ease;
        z-index: 999;
    `;
    
    scrollBtn.querySelector('i').style.color = 'white';
    
    scrollBtn.addEventListener('click', function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    
    // Show/hide scroll button based on scroll position
    window.addEventListener('scroll', function() {
        if (window.pageYOffset > 300) {
            scrollBtn.style.opacity = '1';
            scrollBtn.style.visibility = 'visible';
        } else {
            scrollBtn.style.opacity = '0';
            scrollBtn.style.visibility = 'hidden';
        }
    });
    
    document.body.appendChild(scrollBtn);
}

function addTypingAnimation() {
    const title = document.querySelector('h1');
    if (title && title.textContent.includes('Yaxin Luo')) {
        const text = title.textContent;
        title.textContent = '';
        
        let i = 0;
        function typeWriter() {
            if (i < text.length) {
                title.textContent += text.charAt(i);
                i++;
                setTimeout(typeWriter, 100);
            } else {
                // Add blinking cursor
                const cursor = document.createElement('span');
                cursor.textContent = '|';
                cursor.style.animation = 'blink 1s infinite';
                title.appendChild(cursor);
            }
        }
        
        // Add blink animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes blink {
                0%, 50% { opacity: 1; }
                51%, 100% { opacity: 0; }
            }
        `;
        document.head.appendChild(style);
        
        setTimeout(typeWriter, 500);
    }
}

function addSmoothScrolling() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                target.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
            }
        });
    });
}

function addParticleBackground() {
    const canvas = document.createElement('canvas');
    canvas.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: -1;
        opacity: 0.1;
    `;
    document.body.appendChild(canvas);
    
    const ctx = canvas.getContext('2d');
    let particles = [];
    
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    
    function createParticle() {
        return {
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 0.5,
            vy: (Math.random() - 0.5) * 0.5,
            radius: Math.random() * 2 + 1
        };
    }
    
    function initParticles() {
        particles = [];
        for (let i = 0; i < 50; i++) {
            particles.push(createParticle());
        }
    }
    
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Update and draw particles
        particles.forEach(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            // Wrap around edges
            if (particle.x > canvas.width) particle.x = 0;
            if (particle.x < 0) particle.x = canvas.width;
            if (particle.y > canvas.height) particle.y = 0;
            if (particle.y < 0) particle.y = canvas.height;
            
            // Draw particle
            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            ctx.fillStyle = '#667eea';
            ctx.fill();
        });
        
        // Draw connections
        particles.forEach((particle, i) => {
            particles.slice(i + 1).forEach(otherParticle => {
                const dx = particle.x - otherParticle.x;
                const dy = particle.y - otherParticle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 100) {
                    ctx.beginPath();
                    ctx.moveTo(particle.x, particle.y);
                    ctx.lineTo(otherParticle.x, otherParticle.y);
                    ctx.strokeStyle = `rgba(102, 126, 234, ${1 - distance / 100})`;
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                }
            });
        });
        
        requestAnimationFrame(animate);
    }
    
    resizeCanvas();
    initParticles();
    animate();
    
    window.addEventListener('resize', () => {
        resizeCanvas();
        initParticles();
    });
}

function addThemeToggle() {
    const themeToggle = document.createElement('div');
    themeToggle.style.cssText = `
        position: fixed;
        top: 100px;
        right: 30px;
        width: 50px;
        height: 50px;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: all 0.3s ease;
        z-index: 999;
        box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
    `;
    
    const icon = document.createElement('i');
    icon.className = 'fas fa-moon';
    icon.style.color = 'white';
    themeToggle.appendChild(icon);
    
    themeToggle.addEventListener('click', function() {
        document.body.classList.toggle('dark-mode');
        icon.className = document.body.classList.contains('dark-mode') ? 
            'fas fa-sun' : 'fas fa-moon';
    });
    
    document.body.appendChild(themeToggle);
    
    // Add dark mode styles
    const darkModeStyle = document.createElement('style');
    darkModeStyle.textContent = `
        .dark-mode {
            background-color: #1a1a1a !important;
            color: #e0e0e0 !important;
        }
        .dark-mode .masthead {
            background: #2d2d2d !important;
            border-bottom-color: #444 !important;
        }
        .dark-mode .sidebar {
            background: #2d2d2d !important;
        }
        .dark-mode .author__urls a {
            color: #e0e0e0 !important;
        }
    `;
    document.head.appendChild(darkModeStyle);
}

// Add loading animation
function addLoadingAnimation() {
    const loader = document.createElement('div');
    loader.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 9999;
        transition: opacity 0.5s ease;
    `;
    
    loader.innerHTML = `
        <div style="text-align: center; color: white;">
            <div style="width: 50px; height: 50px; border: 3px solid rgba(255,255,255,0.3); border-top: 3px solid white; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px;"></div>
            <h2 style="margin: 0; font-family: -apple-system, sans-serif;">Loading Yaxin's Portfolio...</h2>
        </div>
    `;
    
    const spinStyle = document.createElement('style');
    spinStyle.textContent = `
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
    `;
    document.head.appendChild(spinStyle);
    
    document.body.appendChild(loader);
    
    // Remove loader after page loads
    window.addEventListener('load', function() {
        setTimeout(() => {
            loader.style.opacity = '0';
            setTimeout(() => loader.remove(), 500);
        }, 1000);
    });
}

// Initialize loading animation immediately
addLoadingAnimation();

/* ========================= New Artistic Features ========================= */

// 1) Signature underline that draws itself under the main title
function addSignatureUnderline() {
    const h1 = document.querySelector('h1.page__title');
    if (!h1) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'signature-underline';
    wrapper.innerHTML = `
      <svg viewBox="0 0 600 24" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="sigGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#667eea"/>
            <stop offset="50%" stop-color="#764ba2"/>
            <stop offset="100%" stop-color="#f093fb"/>
          </linearGradient>
        </defs>
        <path d="M5 12 C 120 26, 220 -2, 320 12 S 520 26, 595 12" />
      </svg>`;
    h1.after(wrapper);
}

// 2) Morphing blobs behind About section (uses .blob-field wrapper)
function addMorphingBlobs() {
    const field = document.querySelector('.blob-field');
    if (!field) return;
    const b1 = document.createElement('span');
    const b2 = document.createElement('span');
    b1.className = 'blob blob-1';
    b2.className = 'blob blob-2';
    field.appendChild(b1);
    field.appendChild(b2);
}

// 3) Orbiting research topic chips around avatar
function addOrbitingTopics() {
    const avatar = document.querySelector('.author__avatar');
    if (!avatar) return;
    const container = document.createElement('div');
    container.className = 'orbiting-topics';
    const topics = [
        { label: 'Vision', radius: 70, dur: 16, delay: 0 },
        { label: 'RL', radius: 50, dur: 12, delay: -2 },
        { label: 'Data', radius: 90, dur: 20, delay: -4 },
        { label: 'Multimodal', radius: 110, dur: 26, delay: -6 },
        { label: 'GenAI', radius: 65, dur: 14, delay: -1 }
    ];
    topics.forEach(t => {
        const s = document.createElement('span');
        s.className = 'topic';
        s.textContent = t.label;
        s.style.setProperty('--radius', t.radius + 'px');
        s.style.setProperty('--duration', t.dur + 's');
        s.style.setProperty('--delay', t.delay + 's');
        container.appendChild(s);
    });
    avatar.appendChild(container);
}

// 4) Filmstrip of publication thumbnails
function addPublicationFilmstrip() {
    const anchor = document.getElementById('pub-strip-anchor');
    if (!anchor) return;

    const imgs = Array.from(document.querySelectorAll('img.publication-image'));
    if (!imgs.length) return;

    const stripWrap = document.createElement('div');
    stripWrap.className = 'pub-filmstrip';
    const strip = document.createElement('div');
    strip.className = 'strip';

    function createItem(img) {
        const item = document.createElement('a');
        item.className = 'item';
        item.href = findPaperLink(img) || '#';
        item.target = item.href !== '#' ? '_blank' : '';
        const clone = img.cloneNode(true);
        clone.removeAttribute('align');
        clone.style.margin = '0';
        clone.style.width = 'auto';
        item.appendChild(clone);
        return item;
    }

    function findPaperLink(img) {
        // Try nearest ancestor block for a paper link
        const block = img.closest('li, p, div, section') || document;
        let link = block.querySelector('a.enhanced-link.paper-link');
        if (link) return link.href;
        // Fallback: search forward in DOM siblings up to a small limit
        let n = block.nextElementSibling, hops = 0;
        while (n && hops < 3) {
            link = n.querySelector && n.querySelector('a.enhanced-link.paper-link');
            if (link) return link.href;
            n = n.nextElementSibling; hops++;
        }
        return null;
    }

    const take = Math.min(imgs.length, 8);
    const chosen = imgs.slice(0, take);
    // Build two copies for seamless loop
    [chosen, chosen].forEach(arr => arr.forEach(img => strip.appendChild(createItem(img))));

    stripWrap.appendChild(strip);
    anchor.replaceWith(stripWrap);
}
