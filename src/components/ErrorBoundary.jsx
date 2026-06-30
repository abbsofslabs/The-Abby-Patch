import { Component } from 'react';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    const { error } = this.state;

    if (error) {
      return (
        <div className="abby-patch-error">
          <h1>Something went wrong</h1>
          <p>The Abby Patch could not load. Try refreshing the page.</p>
          <p className="abby-patch-error__detail">{error.message}</p>
          <button type="button" onClick={() => window.location.reload()}>
            Refresh
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
