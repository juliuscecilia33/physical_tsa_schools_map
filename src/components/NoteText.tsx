import React from 'react';

const URL_SPLIT = /(https?:\/\/\S+)/g;
const URL_TEST = /^https?:\/\/\S+$/;

interface NoteTextProps {
  text: string;
  truncateUrls?: boolean;
}

const NoteText: React.FC<NoteTextProps> = ({ text, truncateUrls = false }) => {
  const parts = text.split(URL_SPLIT);

  return (
    <>
      {parts.map((part, i) =>
        URL_TEST.test(part) ? (
          <a
            key={i}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            className={`text-blue-600 hover:underline ${truncateUrls ? 'block truncate max-w-full' : 'break-all'}`}
          >
            {part}
          </a>
        ) : (
          <React.Fragment key={i}>{part}</React.Fragment>
        )
      )}
    </>
  );
};

export default NoteText;
