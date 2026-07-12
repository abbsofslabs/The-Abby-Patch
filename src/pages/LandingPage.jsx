import { Link } from 'react-router-dom';
import logo from '../assets/abby-patch-logo.png';
import FloralDecorations from '../components/FloralDecorations';

export default function LandingPage() {
  return (
    <div className="abby-patch">
      <FloralDecorations />
      <section className="abby-patch__landing">
        <div className="abby-patch__landing-content">
          <p className="abby-patch__landing-eyebrow">Quilt design studio</p>
          <h1 className="abby-patch__landing-title">
            Design your quilt,
            <br />
            one patch at a time
          </h1>
          <p className="abby-patch__landing-desc">
            Plan your layout, pick fabric colors or shop fabrics from local quilt stores, and
            calculate yardage and cost — all in one cozy place.
          </p>
          <div className="abby-patch__landing-actions">
            <Link to="/auth" className="abby-patch__button abby-patch__button--start">
              Sign in
            </Link>
            <Link to="/auth?mode=signup" className="abby-patch__button abby-patch__button--secondary">
              Create account
            </Link>
          </div>
        </div>
        <div className="abby-patch__landing-logo-wrap">
          <img src={logo} alt="The Abby Patch" className="abby-patch__landing-logo" />
        </div>
      </section>
    </div>
  );
}
