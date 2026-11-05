import {createRoot} from 'react-dom/client';
import {App} from './ui/App';
import './ui/style.css';

const root=document.getElementById('root');
if(!root)throw new Error('AETHER STRIKE root element not found');
createRoot(root).render(<App/>);
