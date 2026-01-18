(function () {
  'use strict';

  // === NAVIGATION ACTIVE STATE ===
  const path = (location.pathname.split("/").pop() || "index.html").toLowerCase();

  const map = {
    "index.html": "nav-home",
    "services.html": "nav-services",
    "tarifs.html": "nav-tarifs",
    "a-propos.html": "nav-apropos",
    "contact.html": "nav-contact",
    "mention-legales.html": "nav-legal",
  };

  const id = map[path];
  if (id) {
    const el = document.getElementById(id);
    if (el) el.classList.add("active");
  }

  // === SMOOTH SCROLL FOR ANCHOR LINKS ===
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#' || href === '') return;

      e.preventDefault();
      const target = document.querySelector(href);

      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });

        // Update URL without triggering scroll
        history.pushState(null, null, href);
      }
    });
  });

  // === ANIMATE ON SCROLL ===
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

  // Observe all cards
  document.addEventListener('DOMContentLoaded', () => {
    const cards = document.querySelectorAll('.card, .section');
    cards.forEach((card, index) => {
      card.style.opacity = '0';
      card.style.transform = 'translateY(30px)';
      card.style.transition = `opacity 0.6s ease ${index * 0.1}s, transform 0.6s ease ${index * 0.1}s`;
      observer.observe(card);
    });
  });

  // === ADD HOVER EFFECT TO BUTTONS ===
  document.querySelectorAll('.btn, .pill').forEach(btn => {
    btn.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-3px) scale(1.02)';
    });

    btn.addEventListener('mouseleave', function() {
      this.style.transform = '';
    });
  });

  // === INTERACTIVE CARDS ===
  document.querySelectorAll('.card').forEach(card => {
    card.addEventListener('mouseenter', function() {
      this.style.transform = 'translateY(-6px)';
    });

    card.addEventListener('mouseleave', function() {
      this.style.transform = '';
    });
  });

  // === SCROLL PROGRESS INDICATOR ===
  const createScrollIndicator = () => {
    const indicator = document.createElement('div');
    indicator.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      height: 3px;
      background: linear-gradient(90deg, #ff6a00, #ff8533);
      z-index: 9999;
      transition: width 0.1s ease;
      box-shadow: 0 0 10px rgba(255,106,0,.5);
    `;
    document.body.appendChild(indicator);

    window.addEventListener('scroll', () => {
      const winScroll = document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = (winScroll / height) * 100;
      indicator.style.width = scrolled + '%';
    });
  };

  createScrollIndicator();

  // === PHONE NUMBER ANIMATION ===
  const phoneLinks = document.querySelectorAll('a[href^="tel:"]');
  phoneLinks.forEach(link => {
    link.addEventListener('click', function() {
      // Add pulse animation
      this.style.animation = 'pulse 0.5s ease';
      setTimeout(() => {
        this.style.animation = '';
      }, 500);
    });
  });

  // === HEADER SHADOW ON SCROLL ===
  const header = document.querySelector('.topbar');
  if (header) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 50) {
        header.style.boxShadow = '0 4px 20px rgba(0,0,0,0.5)';
      } else {
        header.style.boxShadow = '';
      }
    });
  }

  // === EASTER EGG: Konami Code ===
  let konamiCode = [];
  const konamiPattern = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a'];

  document.addEventListener('keydown', (e) => {
    konamiCode.push(e.key);
    konamiCode = konamiCode.slice(-10);

    if (konamiCode.join(',') === konamiPattern.join(',')) {
      // Easter egg activated!
      document.body.style.animation = 'rainbow 2s infinite';

      const style = document.createElement('style');
      style.textContent = `
        @keyframes rainbow {
          0% { filter: hue-rotate(0deg); }
          100% { filter: hue-rotate(360deg); }
        }
      `;
      document.head.appendChild(style);

      setTimeout(() => {
        document.body.style.animation = '';
        style.remove();
      }, 5000);

      // Show notification
      const notification = document.createElement('div');
      notification.textContent = '🦊 Mode FOXCARS Turbo activé! 🚀';
      notification.style.cssText = `
        position: fixed;
        top: 100px;
        left: 50%;
        transform: translateX(-50%);
        background: linear-gradient(135deg, #ff6a00, #ff8533);
        color: white;
        padding: 16px 24px;
        border-radius: 999px;
        font-weight: bold;
        z-index: 10000;
        box-shadow: 0 8px 32px rgba(255,106,0,.5);
        animation: slideDown 0.5s ease;
      `;
      document.body.appendChild(notification);

      setTimeout(() => {
        notification.remove();
      }, 3000);
    }
  });

  // === PERFORMANCE: Lazy load images ===
  if ('loading' in HTMLImageElement.prototype) {
    const images = document.querySelectorAll('img');
    images.forEach(img => {
      if (!img.hasAttribute('loading')) {
        img.setAttribute('loading', 'lazy');
      }
    });
  }

  console.log('%c🦊 FOXCARS Website', 'color: #ff6a00; font-size: 20px; font-weight: bold;');
  console.log('%cInspection automobile indépendante', 'color: #ff8533; font-size: 14px;');
  console.log('%c📞 06 66 54 55 88', 'color: white; font-size: 16px; font-weight: bold;');
})();
