import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { CromaLogo } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { showSuccess, showError } from '@/utils/toast';
import { Loader2 } from 'lucide-react';

export default function Login() {
  const { session, isLoading } = useAuth();
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');

  useEffect(() => {
    if (session) {
      navigate('/');
    }
  }, [session, navigate]);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        showSuccess('Login realizado com sucesso!');
      } else {
        if (!firstName || !lastName) {
          showError('Por favor, preencha seu nome e sobrenome.');
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              first_name: firstName,
              last_name: lastName,
            }
          }
        });
        if (error) throw error;
        showSuccess('Cadastro realizado! Você já pode entrar.');
        setIsLogin(true);
      }
    } catch (error: any) {
      console.error("Erro detalhado do Supabase:", error);
      
      // Traduzindo os erros mais comuns do Supabase
      let errorMessage = error.message;
      if (errorMessage === 'Invalid login credentials') {
        errorMessage = 'E-mail ou senha incorretos.';
      } else if (errorMessage === 'User already registered') {
        errorMessage = 'Este e-mail já está cadastrado no sistema.';
      } else if (errorMessage.includes('Password should be at least')) {
        errorMessage = 'A senha deve ter pelo menos 6 caracteres.';
      } else if (errorMessage.includes('Email not confirmed')) {
        errorMessage = 'E-mail não confirmado. Verifique sua caixa de entrada.';
      }
      
      showError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50">
        <div className="w-10 h-10 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 border border-slate-100 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col items-center mb-8">
          <CromaLogo className="h-12 mb-6" />
          <h1 className="text-2xl font-black text-slate-800">
            {isLogin ? 'Acesso ao Sistema' : 'Criar Conta'}
          </h1>
          <p className="text-slate-500 text-sm mt-1 text-center">
            {isLogin ? 'Faça login para gerenciar instalações e clientes.' : 'Cadastre-se para acessar o painel.'}
          </p>
        </div>
        
        <form onSubmit={handleAuth} className="space-y-4">
          {!isLogin && (
            <div className="grid grid-cols-2 gap-3 animate-in fade-in slide-in-from-top-2">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">Nome</label>
                <Input 
                  required 
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Seu nome" 
                  className="h-12 rounded-xl bg-slate-50 border-slate-200" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-slate-700">Sobrenome</label>
                <Input 
                  required 
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Seu sobrenome" 
                  className="h-12 rounded-xl bg-slate-50 border-slate-200" 
                />
              </div>
            </div>
          )}
          
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700">E-mail</label>
            <Input 
              required 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com" 
              className="h-12 rounded-xl bg-slate-50 border-slate-200" 
            />
          </div>
          
          <div className="space-y-1.5">
            <label className="text-sm font-bold text-slate-700">Senha</label>
            <Input 
              required 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" 
              className="h-12 rounded-xl bg-slate-50 border-slate-200" 
              minLength={6}
            />
          </div>

          <Button 
            type="submit" 
            disabled={loading}
            className="w-full h-12 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-base mt-2 shadow-sm"
          >
            {loading ? <Loader2 className="animate-spin mr-2" size={20} /> : null}
            {isLogin ? 'Entrar no Sistema' : 'Cadastrar'}
          </Button>
        </form>

        <div className="mt-6 text-center">
          <button 
            type="button"
            onClick={() => setIsLogin(!isLogin)}
            className="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors"
          >
            {isLogin ? 'Não tem uma conta? Cadastre-se' : 'Já tem uma conta? Entre'}
          </button>
        </div>
      </div>
    </div>
  );
}