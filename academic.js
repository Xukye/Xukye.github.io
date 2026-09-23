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
    const response = await fetch(path, { cache: "no-cache" });
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

  function renderProfile(profile) {
    byId("profile-name").innerHTML = `${escapeHtml(profile.name)}${profile.nameZh ? ` <span class="profile-name-zh" lang="zh-CN">${escapeHtml(profile.nameZh)}</span>` : ""}`;
    byId("profile-role").textContent = profile.role;
    byId("profile-location").textContent = profile.location;
    byId("profile-languages").textContent = profile.languages;
    byId("profile-availability").textContent = profile.availability;
    byId("email-link").href = `mailto:${profile.email}`;

    const interests = String(profile.focus || "").split("/").map((item) => item.trim()).filter(Boolean);
    byId("interest-chips").innerHTML = interests.map((interest) => `<span class="chip">${escapeHtml(interest)}</span>`).join("");
  }

  function renderNavigation() {
    const links = [
      { id: "about", label: "About" },
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
      ${authorRoles.filter((role) => authorRoleLabels[role]).map((role) => `<span class="author-role author-${role}">${authorRoleLabels[role]}</span>`).join("")}
      ${statuses.map((status) => `<span class="publication-status">${escapeHtml(status)}</span>`).join("")}
      ${recognition.map((item) => `<span class="award">★ ${escapeHtml(item)}</span>`).join("")}
      ${renderLinkItems(entry)}
    </div>`;
  }

  function renderLinkItems(entry) {
    const links = Array.isArray(entry.links) ? entry.links : [];
    if (!links.length) return "";

    const icons = { paper: "▤", page: "◎", code: "⌘", data: "▦", video: "▶", misc: "↗" };
    return links.map((link) => {
      const kind = linkKind(link.label);
      const icon = /^preprint$/i.test(String(link.label).trim()) ? "" : `<span aria-hidden="true">${icons[kind]}</span>`;
      return `<a class="link-${kind}" href="${escapeHtml(safeHref(link.url))}" target="_blank" rel="noreferrer">${icon}${escapeHtml(link.label)}</a>`;
    }).join("");
  }

  function renderLinks(entry) {
    const items = renderLinkItems(entry);
    return items ? `<div class="resource-links">${items}</div>` : "";
  }

  function renderCredentialDetail(detail) {
    if (typeof detail === "string") return `<li>${escapeHtml(detail)}</li>`;
    const metadata = [detail.issuer, detail.date, detail.format].filter(Boolean).join(" · ");
    return `<li>
      ${detail.url
        ? `<a href="${escapeHtml(safeHref(detail.url))}" target="_blank" rel="noreferrer">${escapeHtml(detail.title)} <span aria-hidden="true">↗</span></a>`
        : escapeHtml(detail.title)}${metadata ? ` · ${escapeHtml(metadata)}` : ""}
    </li>`;
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

      renderProfile(data.profile);
      renderNavigation();
      byId("page-content").innerHTML = [
        renderAbout(pageById.index),
        renderSimplePage("publications", "Publications & Projects", publicationSections, true),
        renderSimplePage("education", "Education", education ? [education] : []),
        renderSimplePage("experience", "Experience", pageById.experience.sections),
        renderSimplePage("credentials", "Qualifications & Awards", [qualificationSection, awardSection])
      ].join("");
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
