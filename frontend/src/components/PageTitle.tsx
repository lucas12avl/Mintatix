import { useLocation } from 'react-router-dom';

const PageTitle = () => {
  const location = useLocation();
  let title = '';

  // the title of the page will be defined by the path 
  if (location.pathname.startsWith('/events')) {
    title = 'Events';
  } else if (location.pathname.startsWith('/resales')) {
    title = 'Resale';
  } else if (location.pathname.startsWith('/myTickets')) {
    title = 'My Tickets';
  } else {
    title = 'My App';
  }

  return <h1 className="page-title">{title}</h1>


};

export default PageTitle;