import type { FirestoreFilm } from "../../firestore";
import { showToast } from "../dialogs";

export function renderHeroBanner(featuredFilms: FirestoreFilm[], onPlay: (film: FirestoreFilm) => void) {
  const container = document.getElementById("hero-banner")!;
  container.style.display = "flex";
  
  if (featuredFilms.length === 0) {
    container.style.display = "none";
    return;
  }
  
  let currentSlide = 0;
  
  const renderSlides = () => {
    const slidesHtml = featuredFilms.map((film, idx) => `
      <div class="hero-slide-layer ${idx === currentSlide ? 'active' : ''}">
        <div class="hero-banner-bg-blur" style="background-image: url('${film.bannerUrl}')"></div>
        <div class="hero-banner-main-img" style="background-image: url('${film.bannerUrl}')"></div>
      </div>
    `).join("");
    
    const film = featuredFilms[currentSlide];
    const isDraft = film.status === 'draft';
    
    const contentHtml = `
      <div class="hero-gradient"></div>
      <div class="hero-content">
        <span class="hero-badge" ${isDraft ? 'style="background: #00acee;"' : ''}>
          ${isDraft ? '⏳ Coming Soon' : (film.type === 'film' ? 'Film Terbaru' : 'Series Terbaru')}
        </span>
        <h1 class="hero-title">${film.title}</h1>
        <div class="hero-meta">
          ${(film.releaseYear && film.releaseYear !== 0 && film.releaseYear !== '0' && String(film.releaseYear).trim() !== '') ? `<span>${film.releaseYear}</span>` : ''}
          ${film.country ? `<span>• ${film.country}</span>` : ''}
        </div>
      </div>
    `;
    
    const indicatorsHtml = featuredFilms.length > 1 ? `
      <div class="hero-indicators">
        ${featuredFilms.map((_, idx) => `
          <div class="indicator-dot ${idx === currentSlide ? 'active' : ''}" data-idx="${idx}"></div>
        `).join("")}
      </div>
    ` : "";
    
    container.innerHTML = slidesHtml + contentHtml + indicatorsHtml;
    
    container.querySelectorAll(".indicator-dot").forEach(dot => {
      dot.addEventListener("click", (e) => {
        e.stopPropagation();
        currentSlide = parseInt((e.target as HTMLElement).getAttribute("data-idx") || "0");
        renderSlides();
      });
    });
    
    container.onclick = () => {
      if (film.status === 'draft') {
        showToast('Film ini akan segera hadir! Nantikan rilis resminya.', 'info');
      } else {
        onPlay(film);
      }
    };
  };

  renderSlides();
  
  if (featuredFilms.length > 1) {
    const existingInterval = (container as any).slideInterval;
    if (existingInterval) clearInterval(existingInterval);
    
    (container as any).slideInterval = setInterval(() => {
      currentSlide = (currentSlide + 1) % featuredFilms.length;
      renderSlides();
    }, 6000);
  }

  // Parallax effect initialization
  const mainPanel = document.querySelector(".library-main-panel");
  if (mainPanel && !(container as any).parallaxBound) {
    (container as any).parallaxBound = true;
    mainPanel.addEventListener("scroll", () => {
      const scrolled = mainPanel.scrollTop;
      // Memindahkan layer gambar latar belakang lebih lambat dari konten di depannya
      container.querySelectorAll(".hero-slide-layer").forEach(layer => {
        (layer as HTMLElement).style.transform = `translateY(${scrolled * 0.35}px)`;
      });
    }, { passive: true });
  }
}


export function initRowScrollButtons() {
  document.querySelectorAll(".media-row-section").forEach(row => {
    const prevBtn = row.querySelector(".row-nav-btn.prev");
    const nextBtn = row.querySelector(".row-nav-btn.next");
    const scroller = row.querySelector(".row-scroller");
    if (prevBtn && nextBtn && scroller) {
      const newPrev = prevBtn.cloneNode(true);
      const newNext = nextBtn.cloneNode(true);
      prevBtn.parentNode!.replaceChild(newPrev, prevBtn);
      nextBtn.parentNode!.replaceChild(newNext, nextBtn);

      newPrev.addEventListener("click", () => {
        scroller.scrollBy({ left: -360, behavior: "smooth" });
      });
      newNext.addEventListener("click", () => {
        scroller.scrollBy({ left: 360, behavior: "smooth" });
      });
    }
  });
}
