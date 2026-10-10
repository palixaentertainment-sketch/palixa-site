export default function ProfileBadge({ type }) {
  if (!type) return null;
  const official = type === 'official';
  return (
    <span
      className={'profile-badge ' + (official ? 'profile-badge-official' : 'profile-badge-author')}
      title={official ? 'Official Palixia account' : 'Verified author'}
      aria-label={official ? 'Official Palixia account' : 'Verified author'}
    >
      <span aria-hidden="true">{official ? '✓' : '✓'}</span>
      {official ? 'Official Palixia' : 'Verified Author'}
    </span>
  );
}
