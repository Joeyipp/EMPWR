import { FC } from 'react';

const Footer: FC = () => {
  return (
    <footer className="bg-white border-t border-gray-200 py-4">
      <div className="container mx-auto px-4">
        <p className="text-center text-gray-600 text-sm">
          Knowledge Graph Generator &copy; {new Date().getFullYear()} | <a href="#" className="text-primary hover:underline">Terms</a> | <a href="#" className="text-primary hover:underline">Privacy</a>
        </p>
      </div>
    </footer>
  );
};

export default Footer;
