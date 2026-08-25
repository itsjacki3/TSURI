import { useEffect } from 'react';
import Sidebar from './Sidebar';
import Topbar from './Topbar';
import { useSettings } from '../hooks/useSettings';

export default function Layout({ title, children }) {
  const settings = useSettings();

  useEffect(() => {
    document.title = `KES {title} · KES {settings.hotel_name} Hotel Manager`;
  }, [title, settings.hotel_name]);

  return (
    <div className="app">
      <Sidebar />
      <main className="main">
        <Topbar />
        <div className="content">
          {children}
          <div className="footer-note">&copy; {new Date().getFullYear()} {settings.hotel_name} Hotel Manager</div>
        </div>
      </main>
    </div>
  );
}
