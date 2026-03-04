"use client";

import React, { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';

// 1. 初始化 Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function PopmartMarketPro() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasAgreed, setHasAgreed] = useState(false);
  const [phone, setPhone] = useState('');
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // --- 搜索状态 ---
  const [searchStore, setSearchStore] = useState(''); 
  const [searchItem, setSearchItem] = useState('');   
  const [filterType, setFilterType] = useState('all'); 
  const [sortOrder, setSortOrder] = useState('desc'); 

  const [formData, setFormData] = useState({ 
    price: '', shop: '', item: '', contact: '', 
    expiryType: 'today', customDate: '' 
  });

  const fetchPosts = async () => {
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });
      if (data) {
        const now = new Date();
        const validPosts = data.filter(post => !post.expires_at || new Date(post.expires_at) > now);
        setPosts(validPosts);
      }
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (isLoggedIn && hasAgreed) {
      fetchPosts();
      const channel = supabase.channel('realtime_posts')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => fetchPosts())
        .subscribe();
      return () => { supabase.removeChannel(channel); };
    }
  }, [isLoggedIn, hasAgreed]);

  const handlePublish = async (type: 'sell' | 'buy') => {
    if (!formData.price || !formData.item || !formData.contact || !formData.shop) return alert('请填写完整信息');
    setLoading(true);
    
    const getExpiryDate = () => {
        const d = new Date();
        if (formData.expiryType === 'today') d.setHours(23, 59, 59);
        else if (formData.expiryType === 'tomorrow') { d.setDate(d.getDate() + 1); d.setHours(23, 59, 59); }
        else if (formData.customDate) return new Date(formData.customDate + "T23:59:59");
        return d;
    };

    const { error } = await supabase.from('posts').insert([{ 
      ...formData, type, user_phone: phone,
      expires_at: getExpiryDate().toISOString(),
      price: parseFloat(formData.price) 
    }]);

    if (error) alert('发布失败');
    else {
      setFormData({ price: '', shop: '', item: '', contact: '', expiryType: 'today', customDate: '' });
      fetchPosts();
    }
    setLoading(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm('确定要撤回这条发布信息吗？')) {
      const { error } = await supabase.from('posts').delete().eq('id', id);
      if (error) alert('删除失败');
      else fetchPosts();
    }
  };

  const displayPosts = posts
    .filter(p => (filterType === 'all' || p.type === filterType))
    .filter(p => p.shop.toLowerCase().includes(searchStore.toLowerCase()))
    .filter(p => p.item.toLowerCase().includes(searchItem.toLowerCase()))
    .sort((a, b) => sortOrder === 'desc' ? b.price - a.price : a.price - b.price);

  // 1. 登录页
  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <div className="w-full max-w-xs text-center space-y-10">
          <h1 className="text-4xl font-light tracking-tighter text-black">POPMART <span className="font-bold text-pink-500">PRO</span></h1>
          <div className="space-y-4">
            <input 
              type="text" placeholder="手机号登录" 
              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-center outline-none focus:ring-1 focus:ring-black transition-all"
              value={phone} onChange={e => setPhone(e.target.value)}
            />
            <button 
              onClick={() => phone.length === 11 ? setIsLoggedIn(true) : alert('请输入11位手机号')} 
              className="w-full bg-black text-white py-4 rounded-2xl font-bold active:scale-95 transition-transform shadow-xl"
            >即刻进入</button>
          </div>
        </div>
      </div>
    );
  }

  // 2. 完整免责声明页
  if (isLoggedIn && !hasAgreed) {
    return (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-2xl flex items-center justify-center z-50 p-6 sm:p-12 overflow-y-auto">
            <div className="max-w-md w-full space-y-8 my-auto">
                <div className="space-y-2 text-center sm:text-left">
                  <h2 className="text-3xl font-bold tracking-tight text-black">用户须知与声明</h2>
                  <p className="text-xs text-gray-400 font-bold tracking-widest uppercase">Disclaimer & Terms</p>
                </div>
                
                <div className="text-[13px] text-gray-600 leading-relaxed space-y-5 bg-gray-50/50 p-6 rounded-[2rem] border border-gray-100">
                    <p className="font-bold text-black text-sm text-center">欢迎使用专注自提交流站</p>
                    <div className="space-y-4">
                      <p><strong>1. 信息中转站：</strong>本平台仅为玩家提供自提码转让与求购的信息发布空间，不提供任何担保、中介或支付服务。</p>
                      <p><strong>2. 风险自担：</strong>交易双方应自行承担交易风险。我们强烈建议您在交易前核实对方的真实性，并保留聊天记录和支付凭证。</p>
                      <p><strong>3. 严禁违规：</strong>严禁发布任何违法、违规、虚假或误导性信息。一经发现，我们将永久封禁相关账号及微信号。</p>
                      <p><strong>4. 责任豁免：</strong>平台不对因使用本服务而产生的任何直接、间接、偶然或特殊的损害承担责任。</p>
                      <p><strong>5. 内容声明：</strong>用户发布的任何内容仅代表其个人观点，不代表本站立场。</p>
                      <p><strong>6. 隐私保护：</strong>我们重视您的隐私，您的微信号仅在其他用户点击复制时才会显示并记录计数。</p>
                    </div>
                </div>

                <button 
                  onClick={() => setHasAgreed(true)} 
                  className="w-full bg-black text-white py-5 rounded-3xl font-bold active:scale-95 transition-all shadow-2xl hover:bg-gray-800"
                >阅读并同意协议</button>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] antialiased pb-12">
      {/* 顶部黑金滚动条 */}
      <div className="bg-black text-white py-2 overflow-hidden sticky top-0 z-50 shadow-md">
        <div className="whitespace-nowrap animate-scroll inline-block text-[10px] font-bold tracking-[0.2em] opacity-90">
          PRO EXCHANGE / 实时自提数据监控中 / 线下核实 / 严禁欺诈 &nbsp;&nbsp;&nbsp;&nbsp; 
          PRO EXCHANGE / 实时自提数据监控中 / 线下核实 / 严禁欺诈
        </div>
      </div>

      <style jsx global>{`
        @keyframes scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-scroll { animation: scroll 25s linear infinite; }
        .neon-sell:hover { box-shadow: 0 0 30px rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2) !important; }
        .neon-buy:hover { box-shadow: 0 0 30px rgba(59, 130, 246, 0.1); border-color: rgba(59, 130, 246, 0.2) !important; }
      `}</style>

      <main className="max-w-2xl mx-auto px-6 py-12">
        {/* 发布面板 */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-100 space-y-4 neon-sell transition-all">
            <span className="text-[10px] font-black tracking-widest text-red-500 px-1 uppercase">Pro Sell / 出售</span>
            <input placeholder="价格 (元)" className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm" value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})} />
            <input placeholder="自提门店" className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm" value={formData.shop} onChange={e=>setFormData({...formData, shop:e.target.value})} />
            <input placeholder="商品全名" className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm" value={formData.item} onChange={e=>setFormData({...formData, item:e.target.value})} />
            <input placeholder="个人微信号" className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm" value={formData.contact} onChange={e=>setFormData({...formData, contact:e.target.value})} />
            <button onClick={()=>handlePublish('sell')} className="w-full bg-red-500 text-white py-4 rounded-2xl font-bold active:scale-95 transition-all shadow-xl shadow-red-50">立即上架</button>
          </div>

          <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-100 space-y-4 neon-buy transition-all">
            <span className="text-[10px] font-black tracking-widest text-blue-500 px-1 uppercase">Pro Buy / 求购</span>
            <input placeholder="求购价" className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm" value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})} />
            <input placeholder="目标门店" className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm" value={formData.shop} onChange={e=>setFormData({...formData, shop:e.target.value})} />
            <input placeholder="求购商品" className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm" value={formData.item} onChange={e=>setFormData({...formData, item:e.target.value})} />
            <input placeholder="个人微信号" className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm" value={formData.contact} onChange={e=>setFormData({...formData, contact:e.target.value})} />
            <button onClick={()=>handlePublish('buy')} className="w-full bg-blue-500 text-white py-4 rounded-2xl font-bold active:scale-95 transition-all shadow-xl shadow-blue-50">发布需求</button>
          </div>
        </section>

        {/* 拆分搜索控制台 */}
        <section className="mb-8 space-y-4">
          <div className="flex items-end justify-between px-2">
            <h2 className="text-3xl font-bold tracking-tighter">实时大厅</h2>
            <div className="flex gap-4 text-[10px] font-black text-gray-400">
              <select className="bg-transparent outline-none cursor-pointer hover:text-black" onChange={e=>setFilterType(e.target.value)}>
                <option value="all">全部类型</option>
                <option value="sell">仅看出售</option>
                <option value="buy">仅看求购</option>
              </select>
              <select className="bg-transparent outline-none cursor-pointer hover:text-black" onChange={e=>setSortOrder(e.target.value)}>
                <option value="desc">价格↓</option>
                <option value="asc">价格↑</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              placeholder="🔍 搜索自提门店" 
              className="flex-1 p-5 bg-white rounded-3xl shadow-sm border border-gray-50 outline-none focus:ring-1 focus:ring-black transition-all text-sm font-bold"
              value={searchStore}
              onChange={e => setSearchStore(e.target.value)}
            />
            <input 
              placeholder="📦 搜索商品全名" 
              className="flex-1 p-5 bg-white rounded-3xl shadow-sm border border-gray-50 outline-none focus:ring-1 focus:ring-black transition-all text-sm font-bold"
              value={searchItem}
              onChange={e => setSearchItem(e.target.value)}
            />
          </div>
        </section>

        {/* 卡片流 */}
        <div className="space-y-4">
          {displayPosts.map(post => (
            <div key={post.id} className="bg-white p-6 rounded-[2.5rem] border border-gray-50 flex flex-col sm:flex-row justify-between items-center gap-6 hover:shadow-xl transition-all duration-500 group">
              <div className="flex-1 text-center sm:text-left space-y-1">
                <div className="flex items-center justify-center sm:justify-start gap-3">
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-black tracking-widest ${post.type === 'sell' ? 'bg-red-50 text-red-500' : 'bg-blue-50 text-blue-500'}`}>
                    {post.type === 'sell' ? 'SELL' : 'BUY'}
                  </span>
                  <span className="text-3xl font-bold tracking-tight">￥{post.price}</span>
                </div>
                <h4 className="text-lg font-bold pt-1">{post.shop}</h4>
                <p className="text-gray-400 text-xs font-bold">{post.item}</p>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => {navigator.clipboard.writeText(post.contact); alert('微信号已复制');}}
                  className="bg-black text-white px-10 py-4 rounded-2xl text-[11px] font-black active:scale-90 transition-all shadow-xl"
                >复制微信</button>
                {post.user_phone === phone && (
                  <button onClick={() => handleDelete(post.id)} className="p-4 text-gray-200 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                  </button>
                )}
              </div>
            </div>
          ))}
          {displayPosts.length === 0 && (
            <div className="text-center py-24 text-gray-200 font-bold tracking-widest uppercase">No Active Data</div>
          )}
        </div>
      </main>
    </div>
  );
}
