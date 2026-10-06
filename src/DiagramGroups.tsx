import { memo } from 'react';

const tags = [
  { id: '6347:35539', x: 10, y: 10, width: 122, icon: 'home_work', label: 'AT YOUR site' },
  { id: '6347:35540', x: 318, y: 59, width: 87, icon: 'partly_cloudy_day', label: 'Weather' },
  { id: '6347:35541', x: 599, y: 59, width: 80, icon: 'euro_symbol', label: 'Prices' },
];

// Fixed Figma coordinates share the same camera as the nodes and connectors.
const DiagramGroups = memo(function DiagramGroups() {
  return <div className="diagram-groups" aria-hidden="true">
    <div className="connect-group" data-node-id="6347:35489">
      <img className="connect-group-logo" data-node-id="6347:35532" src="/assets/imgSgConnectLong1.svg" width={173} height={32} alt="" draggable={false} />
      <div className="site-group" data-node-id="6347:35538">
        <svg className="site-group-outline" width={3780} height={2211} viewBox="0 0 3780 2211" fill="none">
          <rect x={0.5} y={0.5} width={3779} height={2210} rx={23.5} stroke="#7c868e" strokeWidth={1} strokeDasharray="10 10" />
        </svg>
        {tags.map(tag => <div key={tag.id} className="group-tag" data-node-id={tag.id} style={{ left: tag.x, top: tag.y, width: tag.width }}>
          <span className="material-symbol">{tag.icon}</span><span>{tag.label}</span>
        </div>)}
      </div>
    </div>
  </div>;
});

export default DiagramGroups;
