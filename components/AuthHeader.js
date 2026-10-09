import Logo from '@/components/Logo';

// Used on the login and signup screens in place of the full navigation, so the logo is the
// identity of the page and nothing competes with the form.
export default function AuthHeader() {
  return (
    <header className="authbar">
      <div className="wrap">
        <Logo size="auth" />
      </div>
    </header>
  );
}
