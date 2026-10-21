import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Empty } from '../components/ui';

export default function NotFound() {
  return (
    <div className="card">
      <Empty
        icon={Compass}
        title="Page not found"
        message="The page you are looking for does not exist or has moved."
        action={
          <Link to="/" className="btn btn-primary">
            Back to dashboard
          </Link>
        }
      />
    </div>
  );
}
