import { useNavigate } from 'react-router-dom';
import Card from '../../components/ui/Card';
import backgroundImg from '../../assets/images/background.png';

const Register = () => {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen bg-cover bg-center flex items-center justify-center"
      style={{ backgroundImage: `url(${backgroundImg})` }}
    >
      <Card className="w-full max-w-md mx-4 px-10 py-10">
        <h1 className="font-display text-3xl text-center text-neutral-dark mb-6">
          Sign up 🐾
        </h1>

        <div className="flex rounded-xl overflow-hidden mb-8">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className="flex-1 py-2.5 font-body text-sm text-neutral-dark bg-rose-md hover:brightness-95 transition-colors"
          >
            Sign in
          </button>
          <button
            type="button"
            className="flex-1 py-2.5 font-body text-sm text-white bg-rose-dark transition-colors"
          >
            Sign up
          </button>
        </div>

        <p className="font-body text-sm text-neutral-gray text-center">
          Registration form coming soon.
        </p>
      </Card>
    </div>
  );
};

export default Register;
