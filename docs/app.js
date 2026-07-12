const state = {
  industries: [],
  useCases: [],
  robotTypes: [],
  allCases: [],
  matrix: { cells: {}, industryTotals: {}, usecaseTotals: {} },
  vendorCounts: [],
  countryCounts: [],
  robotTypeCounts: [],
  filterIndustry: null,
  filterUsecase: null,
  filterVendor: null,
  filterCountry: null,
  filterRobotType: null,
  cases: [],
};

const els = {
  matrixToggle: document.getElementById("matrix-toggle"),
  matrixContent: document.getElementById("matrix-content"),
  matrixTable: document.getElementById("matrix-table"),
  vendorToggle: document.getElementById("vendor-toggle"),
  vendorChips: document.getElementById("vendor-chips"),
  countryToggle: document.getElementById("country-toggle"),
  countryChips: document.getElementById("country-chips"),
  robotTypeToggle: document.getElementById("robot-type-toggle"),
  robotTypeChips: document.getElementById("robot-type-chips"),
  caseList: document.getElementById("case-list"),
  filterLabel: document.getElementById("filter-label"),
  listCount: document.getElementById("list-count"),
  clearFilterBtn: document.getElementById("clear-filter-btn"),
  overlay: document.getElementById("modal-overlay"),
  modalClose: document.getElementById("modal-close"),
  modalImageWrap: document.getElementById("modal-image-wrap"),
  modalTags: document.getElementById("modal-tags"),
  modalTitle: document.getElementById("modal-title"),
  modalSource: document.getElementById("modal-source"),
  modalDate: document.getElementById("modal-date"),
  modalSummary: document.getElementById("modal-summary"),
  modalDetailBtn: document.getElementById("modal-detail-btn"),
};

function setupCollapse(toggleBtn, contentEl) {
  toggleBtn.addEventListener("click", () => {
    const expanded = toggleBtn.getAttribute("aria-expanded") === "true";
    toggleBtn.setAttribute("aria-expanded", String(!expanded));
    contentEl.hidden = expanded;
  });
}
setupCollapse(els.matrixToggle, els.matrixContent);
setupCollapse(els.vendorToggle, els.vendorChips);
setupCollapse(els.countryToggle, els.countryChips);
setupCollapse(els.robotTypeToggle, els.robotTypeChips);

// 静的なdata.json（ビルド時にDBから書き出したスナップショット）を読み込み、
// クロス集計・ベンダー件数・絞り込みはすべてブラウザ側で計算する。
async function loadData() {
  const res = await fetch("./data.json");
  const data = await res.json();
  state.industries = data.industries;
  state.useCases = data.useCases;
  
  // Extract unique robot types from cases
  const robotTypeSet = new Set();
  (data.cases || []).forEach(c => {
    (c.robotTypes || []).forEach(rt => robotTypeSet.add(rt));
  });
  state.robotTypes = Array.from(robotTypeSet).sort();
  
  state.allCases = data.cases;
}

function computeMatrix() {
  const cells = {};
  const industryTotals = {};
  const usecaseTotals = {};

  state.allCases.forEach((c) => {
    c.industries.forEach((ind) => {
      industryTotals[ind] = (industryTotals[ind] || 0) + 1;
    });
    c.useCases.forEach((uc) => {
      usecaseTotals[uc] = (usecaseTotals[uc] || 0) + 1;
    });
    c.industries.forEach((ind) => {
      c.useCases.forEach((uc) => {
        if (!cells[ind]) cells[ind] = {};
        cells[ind][uc] = (cells[ind][uc] || 0) + 1;
      });
    });
  });

  state.matrix = { cells, industryTotals, usecaseTotals };
}

function computeVendorCounts() {
  const counts = {};
  state.allCases.forEach((c) => {
    (c.vendors || []).forEach((v) => {
      counts[v] = (counts[v] || 0) + 1;
    });
  });
  const names = Object.keys(counts);
  const isAlphabetic = (name) => /^[A-Za-z]/.test(name);
  const alphabetic = names.filter(isAlphabetic).sort((a, b) => a.localeCompare(b, "en"));
  const other = names.filter((n) => !isAlphabetic(n)).sort((a, b) => a.localeCompare(b, "ja"));
  state.vendorCounts = [...alphabetic, ...other].map((name) => ({ name, cnt: counts[name] }));
}

function computeCountryCounts() {
  const counts = {};
  state.allCases.forEach((c) => {
    (c.countries || []).forEach((v) => {
      counts[v] = (counts[v] || 0) + 1;
    });
  });
  const names = Object.keys(counts);
  const isAlphabetic = (name) => /^[A-Za-z]/.test(name);
  const alphabetic = names.filter(isAlphabetic).sort((a, b) => a.localeCompare(b, "en"));
  const other = names.filter((n) => !isAlphabetic(n)).sort((a, b) => a.localeCompare(b, "ja"));
  state.countryCounts = [...alphabetic, ...other].map((name) => ({ name, cnt: counts[name] }));
}

function computeRobotTypeCounts() {
  const counts = {};
  state.allCases.forEach((c) => {
    (c.robotTypes || []).forEach((rt) => {
      counts[rt] = (counts[rt] || 0) + 1;
    });
  });
  const names = Object.keys(counts);
  state.robotTypeCounts = state.robotTypes.filter((rt) => counts[rt]).map((rt) => ({ name: rt, cnt: counts[rt] || 0 }));
}

function applyCaseFilter() {
  state.cases = state.allCases.filter((c) => {
    if (state.filterIndustry && !c.industries.includes(state.filterIndustry)) return false;
    if (state.filterUsecase && !c.useCases.includes(state.filterUsecase)) return false;
    if (state.filterVendor && !(c.vendors || []).includes(state.filterVendor)) return false;
    if (state.filterCountry && !(c.countries || []).includes(state.filterCountry)) return false;
    if (state.filterRobotType && !(c.robotTypes || []).includes(state.filterRobotType)) return false;
    return true;
  });
}

function renderMatrix() {
  const { industries, useCases } = state;
  const { cells, industryTotals, usecaseTotals } = state.matrix;
  const grandTotal = state.allCases.length;

  let html = "<thead><tr>";
  html += `<th class="corner-cell clickable" data-clear="1">業種 ＼ ユースケース<br><span class="total-row">総数: ${grandTotal}</span></th>`;
  useCases.forEach((uc, j) => {
    html += `<th class="clickable" data-usecase="${escapeAttr(uc)}" data-col="${j}">${escapeHtml(uc)}<br><span class="total-row">(${usecaseTotals[uc] || 0})</span></th>`;
  });
  html += `<th class="total-col">計</th></tr></thead><tbody>`;

  industries.forEach((ind, i) => {
    html += `<tr><th class="industry-th clickable" data-industry="${escapeAttr(ind)}" data-row="${i}">${escapeHtml(ind)} <span class="total-row">(${industryTotals[ind] || 0})</span></th>`;
    useCases.forEach((uc, j) => {
      const cnt = (cells[ind] && cells[ind][uc]) || 0;
      const cls = ["count-cell"];
      if (cnt > 0) cls.push("has-count");
      html += `<td class="${cls.join(" ")}" data-industry="${escapeAttr(ind)}" data-usecase="${escapeAttr(uc)}" data-row="${i}" data-col="${j}">${cnt || "–"}</td>`;
    });
    html += `<td class="total-col" data-row="${i}">${industryTotals[ind] || 0}</td></tr>`;
  });

  html += "</tbody>";
  els.matrixTable.innerHTML = html;

  // 現在の絞り込み条件に対応する行・列を常時ハイライト
  const activeRowIdx = state.filterIndustry ? industries.indexOf(state.filterIndustry) : -1;
  const activeColIdx = state.filterUsecase ? useCases.indexOf(state.filterUsecase) : -1;
  if (activeRowIdx >= 0) {
    els.matrixTable.querySelectorAll(`[data-row="${activeRowIdx}"]`).forEach((el) => el.classList.add("active-row"));
  }
  if (activeColIdx >= 0) {
    els.matrixTable.querySelectorAll(`[data-col="${activeColIdx}"]`).forEach((el) => el.classList.add("active-col"));
  }

  // マウスホバーで行・列（・セルなら両方）をハイライト
  function clearHover() {
    els.matrixTable.querySelectorAll(".row-hover, .col-hover").forEach((el) => el.classList.remove("row-hover", "col-hover"));
  }
  els.matrixTable.querySelectorAll("[data-row], [data-col]").forEach((el) => {
    el.addEventListener("mouseenter", () => {
      clearHover();
      if (el.dataset.row !== undefined) {
        els.matrixTable.querySelectorAll(`[data-row="${el.dataset.row}"]`).forEach((r) => r.classList.add("row-hover"));
      }
      if (el.dataset.col !== undefined) {
        els.matrixTable.querySelectorAll(`[data-col="${el.dataset.col}"]`).forEach((c) => c.classList.add("col-hover"));
      }
    });
  });
  els.matrixTable.addEventListener("mouseleave", clearHover);

  els.matrixTable.querySelectorAll("[data-clear]").forEach((el) => {
    el.addEventListener("click", () => setFilter(null, null, null, null));
  });
  els.matrixTable.querySelectorAll("th.industry-th[data-industry]").forEach((el) => {
    el.addEventListener("click", () => setFilter(el.dataset.industry, null, state.filterVendor, state.filterCountry));
  });
  els.matrixTable.querySelectorAll("th[data-usecase]").forEach((el) => {
    el.addEventListener("click", () => setFilter(null, el.dataset.usecase, state.filterVendor, state.filterCountry));
  });
  els.matrixTable.querySelectorAll("td.count-cell[data-industry][data-usecase]").forEach((el) => {
    el.addEventListener("click", () => {
      if (Number(el.textContent.trim() === "–" ? 0 : el.textContent) === 0) return;
      setFilter(el.dataset.industry, el.dataset.usecase, state.filterVendor, state.filterCountry);
    });
  });
}

function renderVendorChips() {
  if (state.vendorCounts.length === 0) {
    els.vendorChips.innerHTML = `<p class="empty-note">まだベンダー情報を持つ事例がありません。</p>`;
    return;
  }
  els.vendorChips.innerHTML = state.vendorCounts
    .map((v) => {
      const active = state.filterVendor === v.name ? "active" : "";
      return `<button class="vendor-chip ${active}" data-vendor="${escapeAttr(v.name)}">${escapeHtml(v.name)} <span class="vendor-chip-count">${v.cnt}</span></button>`;
    })
    .join("");

  els.vendorChips.querySelectorAll(".vendor-chip").forEach((el) => {
    el.addEventListener("click", () => {
      const next = state.filterVendor === el.dataset.vendor ? null : el.dataset.vendor;
      setFilter(state.filterIndustry, state.filterUsecase, next, state.filterCountry);
    });
  });
}

function renderCountryChips() {
  if (state.countryCounts.length === 0) {
    els.countryChips.innerHTML = `<p class="empty-note">まだ国情報を持つ事例がありません。</p>`;
    return;
  }
  els.countryChips.innerHTML = state.countryCounts
    .map((v) => {
      const active = state.filterCountry === v.name ? "active" : "";
      return `<button class="vendor-chip ${active}" data-country="${escapeAttr(v.name)}">${escapeHtml(v.name)} <span class="vendor-chip-count">${v.cnt}</span></button>`;
    })
    .join("");

  els.countryChips.querySelectorAll(".vendor-chip").forEach((el) => {
    el.addEventListener("click", () => {
      const next = state.filterCountry === el.dataset.country ? null : el.dataset.country;
      setFilter(state.filterIndustry, state.filterUsecase, state.filterVendor, next);
    });
  });
}

function renderRobotTypeChips() {
  if (state.robotTypeCounts.length === 0) {
    els.robotTypeChips.innerHTML = `<p class="empty-note">まだロボットタイプ情報を持つ事例がありません。</p>`;
    return;
  }
  els.robotTypeChips.innerHTML = state.robotTypeCounts
    .map((rt) => {
      const active = state.filterRobotType === rt.name ? "active" : "";
      return `<button class="vendor-chip ${active}" data-robot-type="${escapeAttr(rt.name)}">${escapeHtml(rt.name)} <span class="vendor-chip-count">${rt.cnt}</span></button>`;
    })
    .join("");

  els.robotTypeChips.querySelectorAll(".vendor-chip").forEach((el) => {
    el.addEventListener("click", () => {
      const next = state.filterRobotType === el.dataset.robotType ? null : el.dataset.robotType;
      setFilter(state.filterIndustry, state.filterUsecase, state.filterVendor, state.filterCountry, next);
    });
  });
}

function renderFilterLabel() {
  const parts = [];
  if (state.filterIndustry) parts.push(`業種: ${state.filterIndustry}`);
  if (state.filterUsecase) parts.push(`ユースケース: ${state.filterUsecase}`);
  if (state.filterVendor) parts.push(`ベンダー: ${state.filterVendor}`);
  if (state.filterCountry) parts.push(`国: ${state.filterCountry}`);
  if (state.filterRobotType) parts.push(`ロボットタイプ: ${state.filterRobotType}`);
  els.filterLabel.textContent = parts.join(" ／ ");
  els.clearFilterBtn.hidden = parts.length === 0;
}

function renderCaseList() {
  els.listCount.textContent = `${state.cases.length}件`;
  if (state.cases.length === 0) {
    els.caseList.innerHTML = `<p class="empty-note">該当する事例がありません。</p>`;
    return;
  }
  els.caseList.innerHTML = state.cases
    .map((c) => {
      const imgStyle = c.image_url ? `style="background-image:url('${escapeAttr(c.image_url)}')"` : "";
      const imgFallback = c.image_url ? "" : "画像なし";
      const tags = [
        ...c.industries.map((t) => `<span class="tag-chip">${escapeHtml(t)}</span>`),
        ...c.useCases.map((t) => `<span class="tag-chip usecase">${escapeHtml(t)}</span>`),
        ...(c.vendors || []).map((t) => `<span class="tag-chip vendor">${escapeHtml(t)}</span>`),
        ...(c.countries || []).map((t) => `<span class="tag-chip country">${escapeHtml(t)}</span>`),
        ...(c.robotTypes || []).map((t) => `<span class="tag-chip robot-type">${escapeHtml(t)}</span>`),
      ].join("");
      return `
        <article class="case-card" data-id="${c.id}" tabindex="0" role="button" aria-label="${escapeAttr(c.title)}">
          <div class="case-card-image" ${imgStyle}>${imgFallback}</div>
          <div class="case-card-body">
            <div class="case-card-tags">${tags}</div>
            <h3 class="case-card-title">${escapeHtml(c.title)}</h3>
            <div class="case-card-footer">
              <span>${escapeHtml(c.source_name || "")}</span>
              <span>${escapeHtml(c.published_date || "")}</span>
            </div>
          </div>
        </article>`;
    })
    .join("");

  els.caseList.querySelectorAll(".case-card").forEach((card) => {
    const open = () => openModal(Number(card.dataset.id));
    card.addEventListener("click", open);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        open();
      }
    });
  });
}

function setFilter(industry, usecase, vendor, country, robotType) {
  state.filterIndustry = industry;
  state.filterUsecase = usecase;
  state.filterVendor = vendor || null;
  state.filterCountry = country || null;
  state.filterRobotType = robotType || null;
  renderMatrix();
  renderVendorChips();
  renderCountryChips();
  renderRobotTypeChips();
  renderFilterLabel();
  applyCaseFilter();
  renderCaseList();
}

// モーダル内のタグをクリックした時: モーダルを閉じ、そのタグ1件だけの条件で絞り込む
function filterByTagOnly(type, value) {
  closeModal();
  if (type === "industry") setFilter(value, null, null, null);
  else if (type === "usecase") setFilter(null, value, null, null);
  else if (type === "vendor") setFilter(null, null, value, null);
  else if (type === "country") setFilter(null, null, null, value);
}

function openModal(id) {
  const c = state.allCases.find((x) => x.id === id);
  if (!c) return;

  els.modalImageWrap.style.backgroundImage = c.image_url ? `url('${c.image_url}')` : "none";
  els.modalImageWrap.style.display = c.image_url ? "block" : "none";
  els.modalTags.innerHTML = [
    ...c.industries.map((t) => `<button type="button" class="tag-chip" data-tag-type="industry" data-tag-value="${escapeAttr(t)}">${escapeHtml(t)}</button>`),
    ...c.useCases.map((t) => `<button type="button" class="tag-chip usecase" data-tag-type="usecase" data-tag-value="${escapeAttr(t)}">${escapeHtml(t)}</button>`),
    ...(c.vendors || []).map((t) => `<button type="button" class="tag-chip vendor" data-tag-type="vendor" data-tag-value="${escapeAttr(t)}">${escapeHtml(t)}</button>`),
    ...(c.countries || []).map((t) => `<button type="button" class="tag-chip country" data-tag-type="country" data-tag-value="${escapeAttr(t)}">${escapeHtml(t)}</button>`),
    ...(c.robotTypes || []).map((t) => `<button type="button" class="tag-chip robot-type" data-tag-type="robot-type" data-tag-value="${escapeAttr(t)}">${escapeHtml(t)}</button>`),
  ].join("");
  els.modalTags.querySelectorAll("[data-tag-type]").forEach((el) => {
    el.addEventListener("click", () => filterByTagOnly(el.dataset.tagType, el.dataset.tagValue));
  });
  els.modalTitle.textContent = c.title;
  els.modalSource.textContent = c.source_name || "";
  els.modalDate.textContent = c.published_date || "";
  els.modalSummary.textContent = c.summary || "(サマリー未登録)";
  els.modalDetailBtn.onclick = () => window.open(c.url, "_blank", "noopener,noreferrer");

  els.overlay.classList.add("open");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  els.overlay.classList.remove("open");
  document.body.style.overflow = "";
}
els.modalClose.addEventListener("click", closeModal);
els.overlay.addEventListener("click", (e) => {
  if (e.target === els.overlay) closeModal();
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && els.overlay.classList.contains("open")) closeModal();
});

els.clearFilterBtn.addEventListener("click", () => setFilter(null, null, null, null));

function escapeHtml(str) {
  return (str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}
function escapeAttr(str) {
  return escapeHtml(str);
}

async function init() {
  await loadData();
  computeMatrix();
  computeVendorCounts();
  computeCountryCounts();
  computeRobotTypeCounts();
  renderMatrix();
  renderVendorChips();
  renderCountryChips();
  renderRobotTypeChips();
  renderFilterLabel();
  applyCaseFilter();
  renderCaseList();
}

init();
