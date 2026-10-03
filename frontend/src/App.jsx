import { Link, NavLink, Route, Routes } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Upload from './pages/Upload.jsx';
import Watch from './pages/Watch.jsx';

export default function App() {
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand" aria-label="Cutroom home">
          <span className="brand-mark" aria-hidden="true">
            <i /><i /><i /><i /><i />
          </span>
          Cutroom
        </Link>
        <nav className="nav">
          <NavLink to="/" end>Library</NavLink>
          <Link to="/upload" className="btn btn-primary">Upload video</Link>
        </nav>
      </header>
      <main className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/upload" element={<Upload />} />
          <Route path="/watch/:id" element={<Watch />} />
          <Route path="*" element={<p className="empty">Page not found. <Link to="/">Back to the library</Link></p>} />
        </Routes>
      </main>
    </>
  );
}
