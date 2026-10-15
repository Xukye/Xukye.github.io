(() => {
  "use strict";

  const byId = (id) => document.getElementById(id);
  const escapeHtml = (value) => String(value ?? "").replace(/[&<>'"]/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[char]);

  const safeHref = (value) => {
    try {
      const url = new URL(value, window.location.href);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "#";
    } catch {
      return "#";
    }
  };

  async function loadJson(path) {
    const response = await fetch(`${path}?_=${Date.now()}`, { cache: "no-cache" });
    if (!response.ok) throw new Error(`Could not load ${path} (${response.status})`);
    return response.json();
  }

  async function loadContent() {
    const site = await loadJson("./content/site.json");
    const pages = await Promise.all(site.tabs.map((tab) => loadJson(tab.source)));
    return {
      profile: site.profile,
      pages: site.tabs.map((tab, index) => ({ ...tab, ...pages[index] }))
    };
  }

  function renderProfile(profile, introduction) {
    byId("profile-name").innerHTML = `${escapeHtml(profile.name)}${profile.nameZh ? ` <span class="profile-name-zh" lang="zh-CN">${escapeHtml(profile.nameZh)}</span>` : ""}`;
    byId("profile-role").textContent = introduction || profile.role;
    byId("email-link").href = `mailto:${profile.email}`;

    const interests = String(profile.focus || "").split("/").map((item) => item.trim()).filter(Boolean);
    byId("interest-chips").innerHTML = interests.map((interest) => `<span class="chip">${escapeHtml(interest)}</span>`).join("");
  }

  function renderNavigation() {
    const links = [
      { id: "publications", label: "Publications & Projects" },
      { id: "education", label: "Education" },
      { id: "experience", label: "Experience" },
      { id: "credentials", label: "Qualifications & Awards" }
    ];

    byId("page-nav").innerHTML = links.map((link) => `
      <a href="#${escapeHtml(link.id)}" data-nav-id="${escapeHtml(link.id)}">${escapeHtml(link.label)}</a>`).join("");
  }

  function linkKind(label) {
    const value = String(label).toLowerCase();
    if (/paper|preprint|pdf|doi|arxiv/.test(value)) return "paper";
    if (/project|page|website/.test(value)) return "page";
    if (/code|github|repo/.test(value)) return "code";
    if (/data|dataset/.test(value)) return "data";
    if (/video|youtube|talk/.test(value)) return "video";
    return "misc";
  }

  function renderPublicationMeta(entry) {
    const statuses = Array.isArray(entry.status) ? entry.status : entry.status ? [entry.status] : [];
    const recognition = Array.isArray(entry.recognition) ? entry.recognition : entry.recognition ? [entry.recognition] : [];
    const presentations = Array.isArray(entry.presentation) ? entry.presentation : entry.presentation ? [entry.presentation] : [];
    const authorRoles = Array.isArray(entry.authorRoles) ? entry.authorRoles : entry.authorRoles ? [entry.authorRoles] : [];
    const links = Array.isArray(entry.links) ? entry.links : [];
    const venueType = ["journal", "conference", "project"].includes(entry.venueType) ? entry.venueType : "project";
    const authorRoleLabels = {
      sole: "Sole Author",
      first: "First Author",
      "co-first": "Co-first Author",
      corresponding: "Corresponding Author",
      "co-author": "Co-author"
    };

    if (!entry.venue && !statuses.length && !recognition.length && !presentations.length && !authorRoles.length && !links.length) return "";

    return `<div class="pub-meta">
      ${entry.venue ? `<span class="publication-venue venue-${venueType}">${escapeHtml(entry.venue)}</span>` : ""}
      ${presentations.map((item) => `<span class="publication-venue venue-conference">${escapeHtml(item)}</span>`).join("")}
      ${statuses.map((status) => {
        const raw = String(status || "").trim();
        const isAccepted = /accepted/i.test(raw);
        const isReview = /review/i.test(raw);
        const text = isAccepted ? raw.replace(/^🎉\s*/, "") : raw;
        const icon = isAccepted ? `<span class="status-emoji" aria-hidden="true">🎉</span>` : "";
        const statusType = isAccepted ? "status-accepted" : (isReview ? "status-under-review" : "status-default");
        return `<span class="publication-status ${statusType}">${icon}${escapeHtml(text)}</span>`;
      }).join("")}
      ${authorRoles.filter((role) => authorRoleLabels[role]).map((role) => `<span class="author-role author-${role}">${authorRoleLabels[role]}</span>`).join("")}
      ${recognition.map((item) => `<span class="award">★ ${escapeHtml(item)}</span>`).join("")}
      ${renderLinkItems(entry)}
    </div>`;
  }

  const GITHUB_SVG = `<svg class="link-icon-svg" viewBox="0 0 16 16" width="10" height="10" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>`;

  function renderLinkItems(entry) {
    const links = Array.isArray(entry.links) ? entry.links : [];
    if (!links.length) return "";

    const icons = { paper: "▤", page: "◎", code: "⌘", data: "▦", video: "▶", misc: "↗" };
    return links.map((link) => {
      const kind = linkKind(link.label);
      let icon = "";
      if (/github/i.test(link.label) || /github\.com/i.test(link.url)) {
        icon = GITHUB_SVG;
      } else if (!/^preprint$/i.test(String(link.label).trim())) {
        icon = `<span aria-hidden="true">${icons[kind]}</span>`;
      }
      return `<a class="link-${kind}" href="${escapeHtml(safeHref(link.url))}" target="_blank" rel="noreferrer">${icon}${escapeHtml(link.label)}</a>`;
    }).join("");
  }

  function renderLinks(entry) {
    const items = renderLinkItems(entry);
    return items ? `<div class="resource-links">${items}</div>` : "";
  }

  function renderCredentialDetail(detail) {
    if (typeof detail === "string") return `<li>${escapeHtml(detail)}</li>`;
    const prefix = detail.date || "";
    const preview = detail.preview
      ? `<span class="credential-preview" aria-hidden="true"><img src="${escapeHtml(detail.preview)}" alt="" loading="lazy" decoding="async"></span>`
      : "";
    const title = detail.url
      ? `<span class="credential-link-wrap"><a href="${escapeHtml(safeHref(detail.url))}" target="_blank" rel="noreferrer">${escapeHtml(detail.title)} <span aria-hidden="true">↗</span></a>${preview}</span>`
      : escapeHtml(detail.title);
    return `<li>${prefix ? `${escapeHtml(prefix)} · ` : ""}${title}${detail.issuer ? ` · ${escapeHtml(detail.issuer)}` : ""}${detail.format ? ` · ${escapeHtml(detail.format)}` : ""}</li>`;
  }

  function sizeCredentialPreviews() {
    document.querySelectorAll(".credential-preview img").forEach((image) => {
      const applyNaturalRatio = () => {
        if (!image.naturalWidth || !image.naturalHeight) return;
        const ratio = Math.min(1.8, Math.max(0.75, image.naturalWidth / image.naturalHeight));
        image.closest(".credential-preview")?.style.setProperty("--certificate-aspect", ratio.toFixed(4));
      };

      if (image.complete) applyNaturalRatio();
      else image.addEventListener("load", applyNaturalRatio, { once: true });
    });
  }

  function renderEntry(entry, publicationStyle = false) {
    const fallbackMeta = entry.meta || [entry.type, entry.venue].filter(Boolean).join(" · ");
    const publicationMeta = publicationStyle ? renderPublicationMeta(entry) : "";
    const subtitle = entry.subtitle || entry.degree;
    const detail = entry.detail || entry.score;
    const experienceLabels = { internship: "Internship", campus: "Campus Experience" };
    const experienceTag = experienceLabels[entry.experienceType]
      ? `<span class="experience-tag experience-${entry.experienceType}">${experienceLabels[entry.experienceType]}</span>`
      : "";
    const structuredMeta = subtitle || detail || experienceTag ? `
      <div class="entry-secondary">
        ${subtitle ? `<span class="entry-subtitle">${escapeHtml(subtitle)}</span>` : ""}
        ${detail ? `<span class="entry-detail">${escapeHtml(detail)}</span>` : ""}
        ${experienceTag}
      </div>` : "";
    return `
      <article class="entry">
        <p class="entry-period">${escapeHtml(entry.period)}</p>
        <div>
          <h3>${escapeHtml(entry.title)}</h3>
          ${publicationMeta || structuredMeta || (fallbackMeta ? `<p class="entry-meta">${escapeHtml(fallbackMeta)}</p>` : "")}
          ${entry.body ? `<p class="entry-body">${escapeHtml(entry.body)}</p>` : ""}
          ${entry.bullets ? `<ul>${entry.bullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>` : ""}
          ${publicationStyle ? "" : renderLinks(entry)}
        </div>
      </article>`;
  }

  function renderSectionBody(section, publicationStyle = false) {
    if (section.type === "prose") {
      return `<div class="prose">${section.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}</div>`;
    }

    if (section.type === "timeline") {
      return `<div class="entry-list">${section.entries.map((entry) => renderEntry(entry, publicationStyle)).join("")}</div>`;
    }

    if (section.type === "list") {
      return `<div class="detail-list">${section.items.map((item) => `
        <article>
          <h3>${escapeHtml(item.title)}</h3>
          ${item.detail ? `<p>${escapeHtml(item.detail)}</p>` : ""}
          ${Array.isArray(item.details) ? `<ul>${item.details.map(renderCredentialDetail).join("")}</ul>` : ""}
        </article>`).join("")}</div>`;
    }

    return "";
  }

  function renderAbout(indexPage) {
    const about = indexPage.sections.find((section) => section.id === "about");
    return `
      <section class="major-section" id="about" data-track-section>
        <header class="section-heading">
          <h2>About Me</h2>
        </header>
        <p class="about-lead">${escapeHtml(indexPage.lead)}</p>
        ${about ? renderSectionBody(about) : ""}
      </section>`;
  }

  function renderSimplePage(id, label, sections, publicationStyle = false) {
    return `
      <section class="major-section" id="${escapeHtml(id)}" data-track-section>
        <header class="section-heading">
          <h2>${escapeHtml(label)}</h2>
        </header>
        ${sections.map((section) => {
          const showTitle = section.title.toLowerCase() !== label.toLowerCase();
          return `<section class="subsection">
            ${showTitle ? `<h3 class="subsection-title">${escapeHtml(section.title)}</h3>` : ""}
            ${renderSectionBody(section, publicationStyle)}
          </section>`;
        }).join("")}
      </section>`;
  }

  function trackSections() {
    const sections = [...document.querySelectorAll("[data-track-section]")];
    const links = [...document.querySelectorAll("[data-nav-id]")];

    const update = () => {
      const marker = window.scrollY + 110;
      let current = sections[0];
      sections.forEach((section) => {
        if (section.offsetTop <= marker) current = section;
      });

      links.forEach((link) => {
        const active = link.dataset.navId === current.id;
        link.classList.toggle("active", active);
        if (active) link.setAttribute("aria-current", "location");
        else link.removeAttribute("aria-current");
      });
    };

    let frame;
    window.addEventListener("scroll", () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        update();
        frame = null;
      });
    }, { passive: true });
    update();
  }

  async function initialise() {
    try {
      const data = await loadContent();
      const pageById = Object.fromEntries(data.pages.map((page) => [page.id, page]));
      const education = pageById.education.sections.find((section) => section.id === "education");
      const qualifications = pageById.education.sections.find((section) => section.id === "qualifications");
      const qualificationItems = (qualifications?.items || []).filter((item) => !/award|scholarship|prize|honou?r|recognition/i.test(`${item.title} ${item.detail}`));
      const awardItems = (qualifications?.items || []).filter((item) => /award|scholarship|prize|honou?r|recognition/i.test(`${item.title} ${item.detail}`));
      const qualificationSection = { id: "qualifications", title: "Qualifications", type: "list", items: qualificationItems };
      const awardSection = { id: "awards", title: "Awards", type: "list", items: awardItems };
      const combinedWorkEntries = pageById.publications.sections.flatMap((section) => section.entries || []);
      const publicationSections = [{
        id: "publications-and-projects",
        title: "Publications & Projects",
        type: "timeline",
        entries: combinedWorkEntries
      }];

      renderProfile(data.profile, pageById.index.lead);
      renderNavigation();
      byId("page-content").innerHTML = [
        renderSimplePage("publications", "Publications & Projects", publicationSections, true),
        renderSimplePage("education", "Education", education ? [education] : []),
        renderSimplePage("experience", "Experience", pageById.experience.sections),
        renderSimplePage("credentials", "Qualifications & Awards", [qualificationSection, awardSection])
      ].join("");
      sizeCredentialPreviews();
      byId("footer-year").textContent = new Date().getFullYear();
      byId("print-cv").addEventListener("click", () => window.print());
      trackSections();

      const anchor = decodeURIComponent(window.location.hash.slice(1));
      const target = anchor && byId(anchor);
      if (target) requestAnimationFrame(() => target.scrollIntoView({ behavior: "auto", block: "start" }));
    } catch (error) {
      console.error(error);
      byId("page-content").innerHTML = `<p class="error" role="alert">The profile could not be loaded. Please open this page through the local web server.</p>`;
    }
  }

  initialise();
})();
