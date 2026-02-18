/* ==========================================================================
   LUXURY ACADEMIC INTERACTIVE FEATURES — YAXIN'S WEBSITE
   Deep Navy + Champagne Gold Theme
   ========================================================================== */

document.addEventListener('DOMContentLoaded', function() {
    const isHome = (location.pathname.replace(/\/+$/, '') === '');

    // Global niceties
    addFloatingContactButton();
    addScrollToTop();
    addSmoothScrolling();

    // Cleanup: ensure any old orbiting topic elements are removed
    document.querySelectorAll('.orbiting-topics').forEach(el => el.remove());

    // Home-specific artistic features
    if (isHome) {
        addTypingAnimation();
        addSignatureUnderline();
        addMorphingBlobs();
        addPublicationFilmstrip();
        addParticleBackground();
        enhancePublicationsSection();
        addScrollReveal();
        addSubtleParallax();
    }
});

/* ========================= Floating Contact Button ========================= */

function addFloatingContactButton() {
    const floatingBtn = document.createElement('div');
    floatingBtn.className = 'floating-contact';
    floatingBtn.innerHTML = '<i class="fas fa-envelope"></i>';
    floatingBtn.setAttribute('title', 'Contact Yaxin');

    floatingBtn.addEventListener('click', function() {
        window.location.href = 'mailto:yaxinluo999@163.com';
    });

    document.body.appendChild(floatingBtn);

    // Magnetic hover effect
    addMagneticEffect(floatingBtn);
}

/* ========================= Scroll to Top ========================= */

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
        background: linear-gradient(135deg, #1a1f3a 0%, #2d1b4e 100%);
        border: 1px solid rgba(201, 169, 110, 0.25);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        opacity: 0;
        visibility: hidden;
        transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 999;
        box-shadow: 0 6px 20px rgba(26, 31, 58, 0.25);
    `;

    scrollBtn.querySelector('i').style.color = '#dfc89a';

    scrollBtn.addEventListener('click', function() {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    scrollBtn.addEventListener('mouseenter', function() {
        scrollBtn.style.boxShadow = '0 10px 30px rgba(26, 31, 58, 0.35), 0 0 0 1px rgba(201, 169, 110, 0.4)';
        scrollBtn.style.transform = 'translateY(-2px)';
    });
    scrollBtn.addEventListener('mouseleave', function() {
        scrollBtn.style.boxShadow = '0 6px 20px rgba(26, 31, 58, 0.25)';
        scrollBtn.style.transform = 'translateY(0)';
    });

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

/* ========================= Typing Animation ========================= */

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
                const cursor = document.createElement('span');
                cursor.textContent = '|';
                cursor.style.animation = 'blink 1s infinite';
                cursor.style.color = '#c9a96e';
                title.appendChild(cursor);
            }
        }

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

/* ========================= Smooth Scrolling ========================= */

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

/* ========================= Particle Background — Gold ========================= */

function addParticleBackground() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const canvas = document.createElement('canvas');
    canvas.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: -1;
        opacity: 0.12;
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
            vx: (Math.random() - 0.5) * 0.4,
            vy: (Math.random() - 0.5) * 0.4,
            radius: Math.random() * 1.5 + 0.8
        };
    }

    function initParticles() {
        particles = [];
        for (let i = 0; i < 30; i++) {
            particles.push(createParticle());
        }
    }

    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        particles.forEach(particle => {
            particle.x += particle.vx;
            particle.y += particle.vy;

            if (particle.x > canvas.width) particle.x = 0;
            if (particle.x < 0) particle.x = canvas.width;
            if (particle.y > canvas.height) particle.y = 0;
            if (particle.y < 0) particle.y = canvas.height;

            ctx.beginPath();
            ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(201, 169, 110, 0.6)';
            ctx.fill();
        });

        particles.forEach((particle, i) => {
            particles.slice(i + 1).forEach(otherParticle => {
                const dx = particle.x - otherParticle.x;
                const dy = particle.y - otherParticle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < 120) {
                    ctx.beginPath();
                    ctx.moveTo(particle.x, particle.y);
                    ctx.lineTo(otherParticle.x, otherParticle.y);
                    ctx.strokeStyle = `rgba(201, 169, 110, ${(1 - distance / 120) * 0.8})`;
                    ctx.lineWidth = 0.4;
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

/* ========================= Loading Animation — Gold Progress Bar ========================= */

function addLoadingAnimation() {
    const bar = document.createElement('div');
    bar.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        height: 3px;
        width: 0;
        background: linear-gradient(90deg, #a8884f, #c9a96e, #dfc89a);
        z-index: 99999;
        transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: 0 0 10px rgba(201, 169, 110, 0.5);
    `;
    document.body.appendChild(bar);

    requestAnimationFrame(() => { bar.style.width = '70%'; });

    window.addEventListener('load', () => {
        bar.style.width = '100%';
        setTimeout(() => {
            bar.style.opacity = '0';
            bar.style.transition = 'opacity 0.3s ease';
            setTimeout(() => bar.remove(), 300);
        }, 200);
    });
}

// Initialize loading animation immediately
addLoadingAnimation();

/* ========================= Signature Underline ========================= */

function addSignatureUnderline() {
    const h1 = document.querySelector('h1.page__title');
    if (!h1) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'signature-underline';
    wrapper.innerHTML = `
      <svg viewBox="0 0 600 24" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="sigGradient" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stop-color="#1a1f3a"/>
            <stop offset="50%" stop-color="#c9a96e"/>
            <stop offset="100%" stop-color="#dfc89a"/>
          </linearGradient>
        </defs>
        <path d="M5 12 C 120 26, 220 -2, 320 12 S 520 26, 595 12" />
      </svg>`;
    h1.after(wrapper);
}

/* ========================= Morphing Blobs ========================= */

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

/* ========================= Publication Filmstrip ========================= */

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
        const block = img.closest('li, p, div, section') || document;
        let link = block.querySelector('a.enhanced-link.paper-link');
        if (link) return link.href;
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
    [chosen, chosen].forEach(arr => arr.forEach(img => strip.appendChild(createItem(img))));

    stripWrap.appendChild(strip);
    anchor.replaceWith(stripWrap);
}

/* ========================= Publications Enhancements ========================= */

function enhancePublicationsSection() {
    document.querySelectorAll('.publication-image').forEach(img => {
        if (!img.hasAttribute('loading')) img.setAttribute('loading', 'lazy');
        img.setAttribute('decoding', 'async');
    });
}

/* ========================= NEW: Scroll-Triggered Reveal ========================= */

function addScrollReveal() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const revealElements = document.querySelectorAll(
        '.pub-entry, .news-item, .about-me-content, .section-header, .research-interests li'
    );

    revealElements.forEach((el) => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(24px)';
    });

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, idx) => {
            if (entry.isIntersecting) {
                // Stagger by a small delay based on visible order
                const delay = idx * 60;
                setTimeout(() => {
                    entry.target.style.transition = 'opacity 0.6s cubic-bezier(0.4, 0, 0.2, 1), transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)';
                    entry.target.style.opacity = '1';
                    entry.target.style.transform = 'translateY(0)';
                }, delay);
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.08, rootMargin: '0px 0px -30px 0px' });

    revealElements.forEach(el => observer.observe(el));
}

/* ========================= NEW: Subtle Parallax on Blobs ========================= */

function addSubtleParallax() {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const blobs = document.querySelectorAll('.blob-field .blob');
    if (!blobs.length) return;

    window.addEventListener('scroll', () => {
        const scrollY = window.pageYOffset;
        blobs.forEach((blob, i) => {
            const speed = 0.03 + (i * 0.015);
            blob.style.transform = `translateY(${scrollY * speed}px)`;
        });
    }, { passive: true });
}

/* ========================= NEW: Magnetic Hover Effect ========================= */

function addMagneticEffect(element) {
    if (!element) return;
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    element.addEventListener('mousemove', (e) => {
        const rect = element.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        element.style.transform = `translate(${x * 0.12}px, ${y * 0.12}px)`;
    });

    element.addEventListener('mouseleave', () => {
        element.style.transform = 'translate(0, 0)';
        element.style.transition = 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)';
    });

    element.addEventListener('mouseenter', () => {
        element.style.transition = 'transform 0.1s ease';
    });
}
