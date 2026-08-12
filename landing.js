// ============================================================
// SCROLL REVEAL ("TUING" POP-IN) PAKAI INTERSECTION OBSERVER
// ============================================================
const elemenReveal = document.querySelectorAll('[data-reveal]');

const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('is-visible');
    }
  });
}, { threshold: 0.15 });

elemenReveal.forEach(el => observer.observe(el));

// ============================================================
// COUNTER ANIMASI UNTUK ANGKA STATISTIK
// Mendukung angka bulat (20, 9, 3) maupun desimal (93.33 -> "93,33%")
// ============================================================
function formatAngka(nilai, desimal) {
  if (desimal) {
    return nilai.toFixed(2).replace('.', ',') + '%';
  }
  return Math.floor(nilai).toString();
}

function animasikanAngka(elemen) {
  const target = parseFloat(elemen.dataset.count);
  const desimal = elemen.dataset.decimal === 'true';
  const durasi = 1200;
  const mulai = performance.now();

  function tick(now) {
    const progres = Math.min((now - mulai) / durasi, 1);
    const nilaiSekarang = progres * target;
    elemen.textContent = formatAngka(nilaiSekarang, desimal);
    if (progres < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

const statObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.querySelectorAll('.stat-num, .rl b').forEach(animasikanAngka);
      statObserver.disconnect();
    }
  });
}, { threshold: 0.3 });

const statStrip = document.querySelector('.stat-strip');
if (statStrip) statObserver.observe(statStrip);

// ============================================================
// CAROUSEL COVERFLOW — SECTION PETA HASIL ANALISIS
// Slide bisa digeser lewat tombol panah, dot, atau klik langsung
// kartu di kiri/kanan. Ada autoplay pelan, berhenti kalau di-hover.
// ============================================================
(function () {
  const track = document.getElementById('petaCarouselTrack');
  if (!track) return;

  const items = Array.from(track.querySelectorAll('.peta-carousel-item'));
  const dotsContainer = document.getElementById('petaCarouselDots');
  const btnPrev = document.getElementById('petaCarouselPrev');
  const btnNext = document.getElementById('petaCarouselNext');
  const total = items.length;
  let active = 0;

  items.forEach((_, i) => {
    const dot = document.createElement('button');
    dot.className = 'peta-carousel-dot';
    dot.setAttribute('aria-label', 'Ke peta ' + (i + 1));
    dot.addEventListener('click', () => goTo(i));
    dotsContainer.appendChild(dot);
  });
  const dots = Array.from(dotsContainer.children);

  function render() {
    items.forEach((item, i) => {
      let diff = i - active;
      if (diff > total / 2) diff -= total;
      if (diff < -total / 2) diff += total;
      item.style.setProperty('--offset', diff);
      item.style.setProperty('--abs-offset', Math.abs(diff));
      item.classList.toggle('is-hidden', Math.abs(diff) > 1);
    });
    dots.forEach((d, i) => d.classList.toggle('is-active', i === active));
  }

  function goTo(index) {
    active = (index + total) % total;
    render();
  }

  // Lightbox: klik peta yang lagi aktif (di tengah) -> buka pratinjau besar.
  // Klik peta di samping tetap menggeser carousel seperti biasa.
  const lightbox = document.getElementById('petaLightbox');
  const lightboxImg = document.getElementById('petaLightboxImg');
  const lightboxTitle = document.getElementById('petaLightboxTitle');
  const lightboxClose = document.getElementById('petaLightboxClose');

  function bukaLightbox(item) {
    const img = item.querySelector('.peta-img-wrap img');
    const judul = item.querySelector('.peta-carousel-title');
    if (!img || !lightbox) return;
    lightboxImg.src = img.src;
    lightboxImg.alt = img.alt;
    lightboxTitle.textContent = judul ? judul.textContent : '';
    lightbox.classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function tutupLightbox() {
    lightbox.classList.remove('is-open');
    document.body.style.overflow = '';
  }

  if (lightboxClose) lightboxClose.addEventListener('click', tutupLightbox);
  if (lightbox) {
    lightbox.addEventListener('click', (e) => {
      if (e.target === lightbox) tutupLightbox();
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox && lightbox.classList.contains('is-open')) tutupLightbox();
  });

  items.forEach((item, i) => {
    item.addEventListener('click', () => {
      if (i !== active) {
        goTo(i);
      } else {
        bukaLightbox(item);
      }
    });
  });

  btnPrev.addEventListener('click', () => goTo(active - 1));
  btnNext.addEventListener('click', () => goTo(active + 1));

  const carouselEl = document.querySelector('.peta-carousel');
  let autoplayTimer = setInterval(() => goTo(active + 1), 4200);
  carouselEl.addEventListener('mouseenter', () => clearInterval(autoplayTimer));
  carouselEl.addEventListener('mouseleave', () => {
    autoplayTimer = setInterval(() => goTo(active + 1), 4200);
  });

  render();
})();

// ============================================================
// TOMBOL KEMBALI KE ATAS
// Muncul setelah scroll melewati satu layar, klik = smooth scroll ke atas
// ============================================================
(function () {
  const tombol = document.getElementById('backToTop');
  if (!tombol) return;

  function cekScroll() {
    if (window.scrollY > window.innerHeight * 0.6) {
      tombol.classList.add('is-visible');
    } else {
      tombol.classList.remove('is-visible');
    }
  }

  window.addEventListener('scroll', cekScroll, { passive: true });
  cekScroll();

  tombol.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
})();