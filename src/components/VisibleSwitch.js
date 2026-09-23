import {useLocation} from 'react-router-dom';
import {useState, useEffect} from 'react';
import Main from './Main';
import MatchAnalysis from './MatchAnalysis';
import RecentPlayers from './RecentPlayers';
import BanPick from "./BanPick";
import Runes from "./Runes";
import ARAM from "./ARAM";
import About from "./About";

function VisibleSwitch() {
  const location = useLocation();
  const [visiblePath, setVisiblePath] = useState(location.pathname);

  useEffect(() => {
    setVisiblePath(location.pathname);
  }, [location]);

  const getVisibility = (path) => visiblePath.includes(path) ? 'block' : 'none';

  const routes = [
    {path: '/main', component: Main},
    {path: '/matchAnalysis', component: MatchAnalysis},
    {path: '/recentPlayers', component: RecentPlayers},
    {path: '/banPick', component: BanPick},
    {path: '/runes', component: Runes},
    {path: '/aram', component: ARAM},
    {path: '/about', component: About},
  ];

  return (
    <div>
      {
        routes.map(({path, component: Component}) => (
          <div key={path} style={{display: getVisibility(path)}}>
            <Component/>
          </div>
        ))
      }
    </div>
  );
}

export default VisibleSwitch;
