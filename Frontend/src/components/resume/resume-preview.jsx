"use client";

import { useEffect, useRef, useState } from "react";

const accentMap = {
  slate: "#334155",
  violet: "#6d28d9",
  cyan: "#0e7490",
};

const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;
const PAGE_GAP_PX = 24;

const TEXT_FIELD_KEYS = [
  "text",
  "value",
  "label",
  "name",
  "title",
  "skill",
  "keyword",
  "technology",
  "tool",
  "summary",
  "description",
  "degree",
  "school",
  "company",
  "role",
  "issuer",
  "url",
  "link",
];

const PLACEHOLDER_TEXT_PATTERNS = [
  /^available upon request\.?$/i,
  /^no .+ added yet\.?$/i,
  /^start with an action verb/i,
];

export default function ResumePreview({ data, livePreview = false, manualPageCount = 0, onAddPage }) {
  const viewportRef = useRef(null);
  const renderData = normalizePreviewData(data);
  const accent = accentMap[renderData.accent] || accentMap.slate;
  const isCompact = renderData.template === "compact";
  const isModern = renderData.template === "modern";
  const contact = [
    renderData.personalInfo.email,
    renderData.personalInfo.phone,
    renderData.personalInfo.location,
    renderData.personalInfo.linkedin,
    renderData.personalInfo.github,
    renderData.personalInfo.portfolio,
  ].filter(Boolean);
  const pages = livePreview
    ? buildManagedResumePages(renderData, manualPageCount)
    : buildResumePages(renderData);
  const pageScale = usePreviewScale(viewportRef, livePreview);
  const scaledPageHeight = A4_HEIGHT_PX * pageScale;
  const scaledGap = PAGE_GAP_PX * pageScale;
  const scaledContentHeight =
    pages.length * scaledPageHeight + Math.max(0, pages.length - 1) * scaledGap;

  return (
    <div ref={viewportRef} className="mx-auto grid w-full justify-items-center gap-4 overflow-visible">
      <div
        className="relative w-full overflow-visible"
        style={{ height: livePreview ? `${scaledContentHeight}px` : "auto" }}
      >
        <div
          id="resume-print-area"
          className="grid text-[#273244]"
          style={{
            fontFamily: "Arial, Helvetica, sans-serif",
            width: `${A4_WIDTH_PX}px`,
            gap: `${PAGE_GAP_PX}px`,
            transform: livePreview ? `scale(${pageScale})` : "none",
            transformOrigin: "top center",
            position: livePreview ? "absolute" : "static",
            top: 0,
            left: livePreview ? "50%" : "auto",
            marginLeft: livePreview ? `${-(A4_WIDTH_PX / 2)}px` : "auto",
            "--resume-density": isCompact ? 0.96 : 0.98,
            "--resume-padding-x": `${isCompact ? 34 : 40}px`,
            "--resume-padding-y": `${isCompact ? 28 : 34}px`,
          }}
        >
          {pages.map((page, index) => (
            <article
              key={page.id}
              className="resume-a4-page overflow-visible bg-white shadow-2xl ring-1 ring-black/5"
            >
              {index === 0 && !page.blank ? (
                <ResumeHeader
                  contact={contact}
                  data={renderData}
                  isModern={isModern}
                  renderData={renderData}
                  accent={accent}
                />
              ) : null}
              {!page.blank ? (
                <div className="resume-sections">
                  {page.blocks.map((block) => (
                    <ResumeBlock key={block.id} block={block} accent={accent} />
                  ))}
                </div>
              ) : null}
            </article>
          ))}
          <style>{`
          #resume-print-area .resume-a4-page {
            width: ${A4_WIDTH_PX}px;
            min-height: ${A4_HEIGHT_PX}px;
            padding: var(--resume-padding-y) var(--resume-padding-x);
            page-break-after: always;
          }
          #resume-print-area header {
            padding-bottom: calc(12px * var(--resume-density));
          }
          #resume-print-area h1 {
            font-size: calc(26px * var(--resume-density));
          }
          #resume-print-area .resume-sections {
            margin-top: calc(${isCompact ? 12 : 14}px * var(--resume-density));
            display: grid;
            gap: calc(${isCompact ? 8 : 10}px * var(--resume-density));
          }
          #resume-print-area h2 {
            margin-bottom: calc(4px * var(--resume-density));
            padding-bottom: calc(3px * var(--resume-density));
            font-size: calc(11.5px * var(--resume-density));
            line-height: 1.15;
          }
          #resume-print-area h3 {
            font-size: calc(10.8px * var(--resume-density));
          }
          #resume-print-area p,
          #resume-print-area li {
            font-size: calc(10.2px * var(--resume-density));
            line-height: 1.34;
            overflow-wrap: anywhere;
            word-break: normal;
          }
          #resume-print-area ul {
            margin-top: calc(2px * var(--resume-density));
            padding-left: calc(15px * var(--resume-density));
          }
          #resume-print-area li {
            margin-bottom: calc(1px * var(--resume-density));
          }
          #resume-print-area .resume-item-stack {
            display: grid;
            gap: calc(7px * var(--resume-density));
          }
          #resume-print-area .resume-meta-line {
            overflow-wrap: anywhere;
            word-break: normal;
          }
          @media print {
            #resume-print-area,
            #resume-print-area .resume-a4-page {
              width: 210mm !important;
              min-height: 297mm !important;
              height: auto !important;
              overflow: visible !important;
              box-shadow: none !important;
              transform: none !important;
              position: static !important;
              margin-left: 0 !important;
            }
          }
        `}</style>
        </div>
      </div>
      {livePreview && onAddPage ? (
        <button
          type="button"
          onClick={onAddPage}
          className="mx-auto inline-flex size-10 items-center justify-center rounded-full border border-fuchsia-400/40 bg-fuchsia-500/15 text-xl font-semibold text-fuchsia-100 shadow-lg shadow-black/20 transition-colors hover:bg-fuchsia-500/25"
          aria-label="Add blank resume page"
        >
          +
        </button>
      ) : null}
    </div>
  );
}

function ResumeHeader({ contact, data, isModern, renderData, accent }) {
  return (
    <header
      className={isModern ? "flex items-start gap-5 border-b" : "border-b text-center"}
      style={{ borderColor: "#d7dce3" }}
    >
      {isModern && data.personalInfo.photo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.personalInfo.photo}
          alt=""
          className="size-20 rounded-full object-cover"
        />
      ) : null}
      <div className="min-w-0 flex-1">
        <h1
          className="break-words font-serif font-bold leading-tight"
          style={{ color: "#273244" }}
        >
          {renderData.personalInfo.name || "Your Name"}
        </h1>
        {renderData.personalInfo.title ? (
          <p className="mt-1 text-[12px] font-semibold uppercase tracking-[0.08em]" style={{ color: accent }}>
            {renderData.personalInfo.title}
          </p>
        ) : null}
        {contact.length ? (
          <p className="resume-meta-line mx-auto mt-2 max-w-[620px] text-[10px] leading-5 text-[#516070]">
            {contact.join("  |  ")}
          </p>
        ) : null}
      </div>
    </header>
  );
}

function usePreviewScale(viewportRef, enabled) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    if (!enabled || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const node = viewportRef.current;
    if (!node) return undefined;

    let frameId = 0;
    const updateScale = () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      frameId = window.requestAnimationFrame(() => {
      const availableWidth = Math.max(0, node.clientWidth);
      const nextScale = availableWidth ? Math.min(1, availableWidth / A4_WIDTH_PX) : 1;
      setScale(Number(nextScale.toFixed(4)));
      });
    };

    updateScale();
    const observer = new ResizeObserver(updateScale);
    observer.observe(node);

    return () => {
      if (frameId) window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [enabled, viewportRef]);

  return enabled ? scale : 1;
}

function ResumeBlock({ block, accent }) {
  if (block.type === "text") return <TextSection title={block.title} text={block.text} accent={accent} />;
  if (block.type === "roles") return <RolePreview title={block.title} items={block.items} accent={accent} />;
  if (block.type === "projects") return <ProjectPreview items={block.items} accent={accent} />;
  if (block.type === "education") return <EducationPreview items={block.items} accent={accent} />;
  if (block.type === "skills") return <SkillPreview title={block.title} value={block.value} accent={accent} />;
  if (block.type === "simple") return <SimplePreview title={block.title} items={block.items} accent={accent} />;
  if (block.type === "list") return <ListPreview title={block.title} items={block.items} accent={accent} />;
  return null;
}

function SectionTitle({ title, accent }) {
  return (
    <h2
      className="mb-1.5 border-b pb-1 text-[12px] font-bold uppercase tracking-[0.04em]"
      style={{ color: accent, borderColor: "#273244" }}
    >
      {title}
    </h2>
  );
}

function TextSection({ title, text, accent }) {
  const normalizedText = normalizeString(text);
  if (!normalizedText) return null;

  return (
    <section>
      <SectionTitle title={title} accent={accent} />
      <p className="leading-[1.48] text-[#374151]">{normalizedText}</p>
    </section>
  );
}

function RolePreview({ title, items, accent }) {
  const visible = visibleStructuredItems(items, "roles");

  if (!visible.length) return null;

  return (
    <section>
      <SectionTitle title={title} accent={accent} />
      <div className="resume-item-stack">
        {visible.map((item) => (
          <div key={item.id}>
            <div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_max-content] sm:gap-4">
              <div className="min-w-0">
                {item.role ? (
                  <h3 className="font-bold leading-tight text-[#273244]">
                    {item.role}
                  </h3>
                ) : null}
                {[item.company, item.location].filter(Boolean).length ? (
                  <p className="resume-meta-line font-semibold leading-tight text-[#4b5563]">
                    {[item.company, item.location].filter(Boolean).join(" | ")}
                  </p>
                ) : null}
              </div>
              {[item.startDate, item.endDate].filter(Boolean).length ? (
                <p className="resume-meta-line text-left font-semibold text-[#4b5563] sm:text-right">
                  {[item.startDate, item.endDate].filter(Boolean).join(" - ")}
                </p>
              ) : null}
            </div>
            <BulletList items={item.bullets} />
          </div>
        ))}
      </div>
    </section>
  );
}

function ProjectPreview({ items, accent }) {
  const visible = visibleStructuredItems(items, "projects");

  if (!visible.length) return null;

  return (
    <section>
      <SectionTitle title="Projects" accent={accent} />
      <div className="resume-item-stack">
        {visible.map((item) => (
          <div key={item.id}>
            <div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)] sm:gap-4">
              {item.name ? (
                <h3 className="min-w-0 font-bold text-[#273244]">
                  {item.name}
                </h3>
              ) : <span />}
              {[item.stack, item.link].filter(Boolean).length ? (
                <p className="resume-meta-line text-left font-semibold text-[#4b5563] sm:text-right">
                  {[item.stack, item.link].filter(Boolean).join(" | ")}
                </p>
              ) : null}
            </div>
            {item.description ? (
              <p className="mt-0.5 leading-[1.45] text-[#4b5563]">
                {item.description}
              </p>
            ) : null}
            <BulletList items={item.bullets} />
          </div>
        ))}
      </div>
    </section>
  );
}

function EducationPreview({ items, accent }) {
  const visible = visibleStructuredItems(items, "education");

  if (!visible.length) return null;

  return (
    <section>
      <SectionTitle title="Education" accent={accent} />
      <div className="resume-item-stack">
        {visible.map((item) => (
          <div key={item.id}>
            <div className="grid gap-1 sm:grid-cols-[minmax(0,1fr)_max-content] sm:gap-4">
              <div className="min-w-0">
                {item.degree ? (
                  <h3 className="font-bold text-[#273244]">
                    {item.degree}
                  </h3>
                ) : null}
                {[item.school, item.location].filter(Boolean).length ? (
                  <p className="resume-meta-line font-semibold text-[#4b5563]">
                    {[item.school, item.location].filter(Boolean).join(" | ")}
                  </p>
                ) : null}
              </div>
              {item.year ? (
                <p className="resume-meta-line text-left font-semibold text-[#4b5563] sm:text-right">
                  {item.year}
                </p>
              ) : null}
            </div>
            {item.details ? (
              <p className="mt-0.5 leading-[1.4] text-[#4b5563]">
                {item.details}
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}

function SkillPreview({ title, value, accent }) {
  const visible = compactList(value);
  if (!visible.length) return null;

  return (
    <section>
      <SectionTitle title={title} accent={accent} />
      <p className="leading-[1.45] text-[#374151]">
        {visible.join(" | ")}
      </p>
    </section>
  );
}

function SimplePreview({ title, items, accent }) {
  const visible = normalizeEntryItems(items).filter((item) => item.title || item.issuer || item.date);

  if (!visible.length) return null;

  return (
    <section>
      <SectionTitle title={title} accent={accent} />
      <ul className="space-y-1">
        {visible.map((item) => (
          <li key={item.id} className="leading-[1.4] text-[#374151]">
            <strong>{item.title}</strong>
            {[item.issuer, item.date].filter(Boolean).length
              ? ` - ${[item.issuer, item.date].filter(Boolean).join(", ")}`
              : ""}
          </li>
        ))}
      </ul>
    </section>
  );
}

function ListPreview({ title, items, accent }) {
  const visible = compactList(items);
  if (!visible.length) return null;

  return (
    <section>
      <SectionTitle title={title} accent={accent} />
      <BulletList items={visible} />
    </section>
  );
}

function BulletList({ items }) {
  const visible = compactList(items);
  if (!visible.length) return null;

  return (
    <ul className="list-disc">
      {visible.map((item, index) => (
        <li key={`${item}-${index}`} className="leading-[1.4] text-[#374151]">
          {item}
        </li>
      ))}
    </ul>
  );
}

function buildResumeBlocks(data) {
  return [
    { id: "summary", type: "text", title: "Professional Summary", text: data.summary },
    { id: "technical-skills", type: "skills", title: "Technical Skills", value: data.technicalSkills },
    buildStructuredBlock("work-experience", "roles", "Professional Experience", data.workExperience),
    buildStructuredBlock("projects", "projects", "Projects", data.projects),
    buildStructuredBlock("internships", "roles", "Internships", data.internships),
    buildStructuredBlock("freelance", "roles", "Freelance Experience", data.freelance),
    buildStructuredBlock("education", "education", "Education", data.education),
    buildStructuredBlock("certifications", "simple", "Certifications", data.certifications),
    { id: "achievements", type: "list", title: "Achievements", items: data.achievements },
    { id: "extracurricular", type: "list", title: "Extracurricular Activities", items: data.extracurricular },
    { id: "languages", type: "skills", title: "Languages", value: data.languages },
    { id: "interests", type: "text", title: "Interests / Hobbies", text: data.interests },
  ].filter((block) => block && hasVisibleBlockContent(block));
}

function buildStructuredBlock(id, type, title, items) {
  const visibleItems = visibleStructuredItems(items, type);
  if (!visibleItems.length) return null;

  return {
    id,
    type,
    title,
    items: visibleItems,
  };
}

function buildManagedResumePages(data, manualPageCount = 0) {
  const pages = packBlocksIntoPages(buildResumeBlocks(data));

  for (let index = 0; index < manualPageCount; index += 1) {
    pages.push({
      id: `manual-page-${index + 1}`,
      blocks: [],
      blank: true,
    });
  }

  return pages.length ? pages : [{ id: "page-1", blocks: [] }];
}

function packBlocksIntoPages(blocks) {
  const pages = [];
  let currentPage = { id: "page-1", blocks: [] };
  let currentWeight = 16;
  const pageLimit = 132;

  blocks.forEach((block) => {
    const slices = splitBlockToFit(block, pageLimit - currentWeight, pageLimit);

    slices.forEach((slice) => {
      if (slice.newPage) {
        pages.push(currentPage);
        currentPage = { id: `page-${pages.length + 1}`, blocks: [] };
        currentWeight = 0;
      }

      currentPage.blocks.push(slice.block);
      currentWeight += slice.weight;
    });
  });

  pages.push(currentPage);
  return pages;
}

function splitBlockToFit(block, remainingSpace, pageLimit) {
  const blockWeight = estimateBlockWeight(block);
  if (blockWeight <= remainingSpace) {
    return [{ block, weight: blockWeight, newPage: false }];
  }

  if (remainingSpace < 7) {
    return [{ block, weight: blockWeight, newPage: true }];
  }

  if (block.type === "list") {
    return splitListBlock(block, remainingSpace, pageLimit);
  }

  if (["roles", "projects", "education", "simple"].includes(block.type)) {
    return splitStructuredBlock(block, remainingSpace, pageLimit);
  }

  return [{ block, weight: blockWeight, newPage: true }];
}

function splitListBlock(block, remainingSpace, pageLimit) {
  const items = compactList(block.items);
  const firstPageItems = [];
  let used = 4;

  for (const item of items) {
    const itemWeight = estimateTextLines(item, 110);
    if (firstPageItems.length && used + itemWeight > remainingSpace) break;
    if (!firstPageItems.length && remainingSpace < 7) break;
    firstPageItems.push(item);
    used += itemWeight;
  }

  if (!firstPageItems.length || firstPageItems.length === items.length) {
    return [{
      block,
      weight: estimateBlockWeight(block),
      newPage: !firstPageItems.length,
    }];
  }

  return [
    {
      block: { ...block, items: firstPageItems },
      weight: estimateBlockWeight({ ...block, items: firstPageItems }),
      newPage: false,
    },
    ...splitBlockToFit(
      { ...block, id: `${block.id}-continued`, title: `${block.title} (continued)`, items: items.slice(firstPageItems.length) },
      pageLimit,
      pageLimit
    ).map((slice, index) => ({ ...slice, newPage: index === 0 || slice.newPage })),
  ];
}

function splitStructuredBlock(block, remainingSpace, pageLimit) {
  const items = visibleStructuredItems(block.items, block.type);
  const firstPageItems = [];
  let used = 5;

  for (const item of items) {
    const itemWeight = estimateStructuredItemWeight(item, block.type);
    if (firstPageItems.length && used + itemWeight > remainingSpace) break;
    if (!firstPageItems.length && remainingSpace < 9) break;
    firstPageItems.push(item);
    used += itemWeight;
  }

  if (!firstPageItems.length || firstPageItems.length === items.length) {
    const splitSingle = splitSingleStructuredItem(block, remainingSpace, pageLimit);
    if (splitSingle) return splitSingle;

    return [{
      block,
      weight: estimateBlockWeight(block),
      newPage: !firstPageItems.length,
    }];
  }

  return [
    {
      block: { ...block, items: firstPageItems },
      weight: estimateBlockWeight({ ...block, items: firstPageItems }),
      newPage: false,
    },
    ...splitBlockToFit(
      { ...block, id: `${block.id}-continued`, title: `${block.title} (continued)`, items: items.slice(firstPageItems.length) },
      pageLimit,
      pageLimit
    ).map((slice, index) => ({ ...slice, newPage: index === 0 || slice.newPage })),
  ];
}

function splitSingleStructuredItem(block, remainingSpace, pageLimit) {
  if (!["roles", "projects"].includes(block.type)) return null;

  const [item] = visibleStructuredItems(block.items, block.type);
  const bullets = compactList(item?.bullets);
  if (!item || bullets.length < 2 || remainingSpace < 12) return null;

  const itemShellWeight = estimateStructuredItemWeight({ ...item, bullets: [] }, block.type);
  const firstBullets = [];
  let used = 5 + itemShellWeight;

  for (const bullet of bullets) {
    const bulletWeight = estimateTextLines(bullet, 110);
    if (firstBullets.length && used + bulletWeight > remainingSpace) break;
    firstBullets.push(bullet);
    used += bulletWeight;
  }

  if (!firstBullets.length || firstBullets.length === bullets.length) return null;

  const firstItem = { ...item, bullets: firstBullets };
  const nextItem = { ...item, role: "", name: "", description: "", bullets: bullets.slice(firstBullets.length) };

  return [
    {
      block: { ...block, items: [firstItem] },
      weight: estimateBlockWeight({ ...block, items: [firstItem] }),
      newPage: false,
    },
    ...splitBlockToFit(
      { ...block, id: `${block.id}-continued`, title: `${block.title} (continued)`, items: [nextItem] },
      pageLimit,
      pageLimit
    ).map((slice, index) => ({ ...slice, newPage: index === 0 || slice.newPage })),
  ];
}

function estimateBlockWeight(block) {
  if (block.type === "text") return 4 + estimateTextLines(block.text, 120);
  if (block.type === "skills") return 4 + estimateTextLines(compactList(block.value).join(" | "), 118);
  if (block.type === "list") {
    return 4 + compactList(block.items).reduce((total, item) => total + estimateTextLines(item, 112), 0);
  }

  if (block.type === "roles") {
    return 5 + visibleStructuredItems(block.items, block.type).reduce(
      (total, item) => total + estimateStructuredItemWeight(item, block.type),
      0
    );
  }

  if (block.type === "projects") {
    return 5 + visibleStructuredItems(block.items, block.type).reduce(
      (total, item) => total + estimateStructuredItemWeight(item, block.type),
      0
    );
  }

  if (block.type === "education") return 5 + visibleStructuredItems(block.items, block.type).length * 4;
  if (block.type === "simple") return 4 + visibleStructuredItems(block.items, block.type).length * 3;
  return 6;
}

function estimateStructuredItemWeight(item, type) {
  if (type === "roles") {
    return (
      3 +
      estimateTextLines([item.role, item.company, item.location, item.startDate, item.endDate].filter(Boolean).join(" "), 118) +
      compactList(item.bullets).reduce((total, bullet) => total + estimateTextLines(bullet, 112), 0)
    );
  }

  if (type === "projects") {
    return (
      3 +
      estimateTextLines([item.name, item.stack, item.link, item.description].filter(Boolean).join(" "), 118) +
      compactList(item.bullets).reduce((total, bullet) => total + estimateTextLines(bullet, 112), 0)
    );
  }

  return 4 + estimateTextLines(Object.values(item || {}).join(" "), 120);
}

function estimateTextLines(value, charsPerLine) {
  const length = normalizeString(value).length;
  if (!length) return 0;
  return Math.max(1, Math.ceil(length / charsPerLine));
}

function buildResumePages(data) {
  return buildManagedResumePages(data);
}

function visibleStructuredItems(items = [], type) {
  const source = normalizeEntryItems(items);
  if (type === "roles") {
    return source.filter(
      (item) =>
        item.role ||
        item.company ||
        item.location ||
        item.startDate ||
        item.endDate ||
        compactList(item.bullets).length
    );
  }

  if (type === "projects") {
    return source.filter(
      (item) =>
        item.name ||
        item.stack ||
        item.link ||
        item.description ||
        compactList(item.bullets).length
    );
  }

  if (type === "education") {
    return source.filter(
      (item) => item.school || item.degree || item.location || item.year || item.details
    );
  }

  return source.filter((item) => item.title || item.issuer || item.date);
}

function hasVisibleBlockContent(block) {
  if (block.type === "text") return Boolean(normalizeString(block.text));
  if (block.type === "skills") return compactList(block.value).length > 0;
  if (block.type === "list") return compactList(block.items).length > 0;
  return visibleStructuredItems(block.items, block.type).length > 0;
}

function compactList(list) {
  return normalizeList(list).filter(isMeaningfulText);
}

function normalizePreviewData(data) {
  const source = normalizeRecord(data);
  const personalInfo = normalizeRecord(source.personalInfo || source.contact);
  const socialLinks = normalizeRecord(source.socialLinks);

  return {
    ...source,
    template: normalizeString(source.template) || "executive",
    accent: normalizeString(source.accent) || "slate",
    personalInfo: {
      name: normalizeString(personalInfo.name || source.name),
      title: normalizeString(personalInfo.title || source.headline || source.title),
      photo: normalizeString(personalInfo.photo),
      email: normalizeString(personalInfo.email),
      phone: normalizeString(personalInfo.phone),
      location: normalizeString(personalInfo.location || personalInfo.address),
      linkedin: normalizeString(personalInfo.linkedin || socialLinks.linkedin),
      github: normalizeString(personalInfo.github || socialLinks.github),
      portfolio: normalizeString(personalInfo.portfolio || socialLinks.portfolio || socialLinks.website),
    },
    summary: normalizeString(source.summary),
    technicalSkills: normalizeString(source.technicalSkills || source.skills || source.technologies || source.tools),
    keywords: normalizeString(source.keywords || source.atsKeywords),
    softSkills: normalizeString(source.softSkills),
    workExperience: normalizeEntryItems(source.workExperience || source.experience).map(normalizeRole),
    internships: normalizeEntryItems(source.internships).map(normalizeRole),
    freelance: normalizeEntryItems(source.freelance).map(normalizeRole),
    projects: normalizeEntryItems(source.projects).map(normalizeProject),
    education: normalizeEntryItems(source.education).map(normalizeEducation),
    certifications: normalizeEntryItems(source.certifications).map(normalizeSimple),
    achievements: normalizeList(source.achievements),
    extracurricular: normalizeList(source.extracurricular),
    languages: normalizeString(source.languages),
    interests: normalizeString(source.interests),
    references: normalizeString(source.references),
  };
}

function normalizeString(value) {
  if (value == null) return "";
  if (typeof value === "string") return isMeaningfulText(value) ? value.trim() : "";
  if (typeof value === "number" || typeof value === "boolean") {
    const text = String(value).trim();
    return isMeaningfulText(text) ? text : "";
  }
  if (Array.isArray(value)) return normalizeList(value).join(", ");

  if (typeof value === "object") {
    for (const key of TEXT_FIELD_KEYS) {
      const normalized = normalizeString(value[key]);
      if (normalized) return normalized;
    }

    return normalizeList(Object.values(value)).join(", ");
  }

  return "";
}

function normalizeList(value) {
  const source = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/[\n,;]+/)
      : value == null
        ? []
        : [value];

  return source.flatMap((item) => {
    if (Array.isArray(item)) return normalizeList(item);
    const text = normalizeString(item);
    return isMeaningfulText(text) ? [text] : [];
  });
}

function isMeaningfulText(value) {
  const text = String(value || "").trim();
  if (!text) return false;
  return !PLACEHOLDER_TEXT_PATTERNS.some((pattern) => pattern.test(text));
}

function normalizeRecord(value = {}) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function normalizeEntryItems(items) {
  if (Array.isArray(items)) return items;
  return items && typeof items === "object" ? [items] : [];
}

function normalizeRole(item = {}) {
  const source = normalizeRecord(item);
  return {
    id: normalizeString(source.id) || `${normalizeString(source.role || source.title)}-${normalizeString(source.company)}`,
    role: normalizeString(source.role || source.title || source.position),
    company: normalizeString(source.company || source.organization || source.employer),
    location: normalizeString(source.location),
    startDate: normalizeString(source.startDate || source.start || source.from),
    endDate: normalizeString(source.endDate || source.end || source.to),
    bullets: normalizeList(source.bullets || source.responsibilities || source.achievements || source.description),
  };
}

function normalizeProject(item = {}) {
  const source = normalizeRecord(item);
  return {
    id: normalizeString(source.id) || normalizeString(source.name || source.title),
    name: normalizeString(source.name || source.title),
    stack: normalizeString(source.stack || source.technologies || source.tools),
    link: normalizeString(source.link || source.url),
    description: normalizeString(source.description || source.summary),
    bullets: normalizeList(source.bullets || source.highlights || source.achievements),
  };
}

function normalizeEducation(item = {}) {
  const source = normalizeRecord(item);
  return {
    id: normalizeString(source.id) || normalizeString(source.school || source.degree),
    school: normalizeString(source.school || source.institution || source.university),
    degree: normalizeString(source.degree || source.qualification),
    location: normalizeString(source.location),
    year: normalizeString(source.year || source.endDate || source.graduationYear),
    details: normalizeString(source.details || source.description || source.coursework),
  };
}

function normalizeSimple(item = {}) {
  const source = normalizeRecord(item);
  return {
    id: normalizeString(source.id) || normalizeString(source.title || source.name),
    title: normalizeString(source.title || source.name),
    issuer: normalizeString(source.issuer || source.organization),
    date: normalizeString(source.date || source.year),
  };
}
