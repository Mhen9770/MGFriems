import { Redirect } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import LoadingSpinner from '../components/LoadingSpinner';

export default function Index() {
  const { session, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner />;
  }

  if (session) {
    return <Redirect href="/(drawer)/(tabs)" />;
  }

  return <Redirect href="/(auth)/login" />;
}
