import { FC } from 'react';

const Instructions: FC = () => {
  return (
    <div className="bg-blue-50 border-l-4 border-primary p-4 mb-6 rounded-md">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-primary" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-blue-800">How to use:</h3>
          <div className="mt-2 text-sm text-blue-700 leading-relaxed">
            <p>1. Paste your unstructured text in the input area on the left.</p>
            <p>2. Click on "Generate Knowledge Graph" to process the text.</p>
            <p>3. Explore the visualization: Drag nodes to reposition, scroll to zoom, drag empty space to pan.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Instructions;
