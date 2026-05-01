import { FC } from 'react';
import { Search } from 'lucide-react';

interface HeaderProps {
  onToggleHelp: () => void;
}

const Header: FC<HeaderProps> = ({ onToggleHelp }) => {
  return (
    <header className="bg-white border-b border-gray-200">
      <div className="container mx-auto px-4 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <Search className="h-8 w-8 text-primary" />
          <h1 className="text-xl font-semibold text-gray-800">Knowledge Graph Generator</h1>
        </div>
        <div>
          <button 
            className="text-gray-600 hover:text-gray-800 font-medium text-sm flex items-center space-x-1 focus:outline-none"
            onClick={onToggleHelp}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Help</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
