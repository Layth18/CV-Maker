import type { ColorConfig, LayoutConfig } from '../../../shared/types';

/** A small schematic of a layout, drawn from its settings (not a render). */
export function TemplateThumb({ layout, colors }: { layout: LayoutConfig; colors: ColorConfig }) {
  const two = layout.columns === 2;
  const sidebarLeft = layout.sidebarPosition === 'left';
  const sw = Math.round(layout.sidebarWidth * 100);
  const banner = layout.headerStyle === 'banner';
  const headerInSidebar = two && layout.headerStyle === 'sidebar';
  const photo = layout.showPhoto;
  const centered = layout.headerStyle === 'centered';
  const lines = (n: number, color = '#c9cfd8') =>
    Array.from({ length: n }, (_, i) => <i key={i} style={{ background: color, width: `${70 + ((i * 37) % 30)}%` }} />);

  const header = (
    <div
      className={`tt-header${banner ? ' banner' : ''}${centered ? ' centered' : ''}`}
      style={banner ? { background: colors.headerBg } : undefined}
    >
      {photo && centered && <span className="tt-photo" />}
      <div className="tt-name-block">
        <b style={{ background: banner ? colors.headerText : colors.primary }} />
        <i style={{ background: banner ? colors.headerText : '#9aa3b0', opacity: 0.8 }} />
      </div>
      {photo && !centered && <span className="tt-photo" style={banner ? { borderColor: colors.headerText } : undefined} />}
    </div>
  );

  const sectionBlock = (n: number, heading: string) => (
    <div className="tt-section">
      <b style={{ background: heading }} />
      {lines(n)}
    </div>
  );

  const sidebar = (
    <div
      className="tt-sidebar"
      style={{ width: `${sw}%`, background: layout.sidebarFilled ? colors.sidebarBg : undefined, order: sidebarLeft ? 0 : 2 }}
    >
      {headerInSidebar && (
        <div className="tt-side-header">
          {photo && <span className="tt-photo" />}
          <b style={{ background: colors.sidebarText }} />
        </div>
      )}
      {sectionBlock(3, layout.sidebarFilled ? colors.sidebarText : colors.heading)}
      {sectionBlock(2, layout.sidebarFilled ? colors.sidebarText : colors.heading)}
    </div>
  );

  return (
    <div className="tt" aria-hidden="true">
      {(!two || !headerInSidebar) && header}
      <div className="tt-body">
        {two && sidebar}
        {two && layout.columnDivider && !layout.sidebarFilled && <span className="tt-divider" style={{ order: 1 }} />}
        <div className="tt-main" style={{ order: 1 }}>
          {sectionBlock(3, colors.heading)}
          {sectionBlock(4, colors.heading)}
          {sectionBlock(2, colors.heading)}
        </div>
      </div>
    </div>
  );
}
