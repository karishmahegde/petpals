interface CardProps {
  children: React.ReactNode;
  className?: string;
}

const Card = ({ children, className = '' }: CardProps) => {
  return (
    <div className={`bg-white rounded-xl shadow-md ${className}`}>
      {children}
    </div>
  );
};

export default Card;
