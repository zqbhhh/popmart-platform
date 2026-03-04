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

  // --- 搜索状态：拆分为门店和商品 ---
  const [searchStore, setSearchStore] = useState(''); 
  const [searchItem, setSearchItem] = useState('');   
  const [filterType, setFilterType] = useState('all'); 
  const [sortOrder, setSortOrder] = useState('desc'); 

  // 表单状态
  const [formData, setFormData] = useState({ 
    price: '', shop: '', item: '', contact: '', 
    expiryType: 'today', customDate: '' 
  });

  // 获取数据
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
    } catch (err) { console.error("读取失败", err); }
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

  // 发布逻辑
  const handlePublish = async (type: 'sell' | 'buy') => {
    if (!formData.price || !formData.item || !formData.contact || !formData.shop) return alert('信息不完整');
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

    if (error) alert('发布失败: ' + error.message);
    else {
      setFormData({ price: '', shop: '', item: '', contact: '', expiryType: 'today', customDate: '' });
      fetchPosts();
    }
    setLoading(false);
  };

  // --- 补全缺失的删除函数 ---
  const handleDelete = async (id: string) => {
    if (confirm('确定要撤回这条专业发布信息吗？')) {
      const { error } = await supabase.from('posts').delete().eq('id', id);
      if (error) alert('删除失败');
      else fetchPosts();
    }
  };

  // --- 核心过滤逻辑：双重匹配 ---
  const displayPosts = posts
    .filter(p => (filterType === 'all' || p.type === filterType))
    .filter(p => p.shop.toLowerCase().includes(searchStore.toLowerCase()))
    .filter(p => p.item.toLowerCase().includes(searchItem.toLowerCase()))
    .sort((a, b) => sortOrder === 'desc' ? b.price - a.price : a.price - b.price);

  // 登录页
  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white font-sans">
        <div className="w-full max-w-xs text-center space-y-12">
          <div className="space-y-2">
            <h1 className="text-4xl font-light tracking-tighter text-black">POPMART <span className="font-bold text-pink-500 text-3xl">PRO</span></h1>
            <p className="text-[10px] tracking-[0.4em] text-gray-400 font-bold uppercase">Professional Exchange</p>
          </div>
          <div className="space-y-4">
            <input 
              type="text" placeholder="手机号" 
              className="w-full p-4 bg-gray-50 border border-gray-100 rounded-2xl text-center outline-none focus:ring-1 focus:ring-black transition-all font-medium"
              value={phone} onChange={e => setPhone(e.target.value)}
            />
            <button 
              onClick={() => phone.length === 11 ? setIsLoggedIn(true) : alert('手机号格式错误')} 
              className="w-full bg-black text-white py-4 rounded-2xl font-bold active:scale-95 transition-transform"
            >验证并进入</button>
          </div>
        </div>
      </div>
    );
  }

  // 免责声明
  if (isLoggedIn && !hasAgreed) {
    return (
        <div className="fixed inset-0 bg-white/95 backdrop-blur-2xl flex items-center justify-center z-50 p-8">
            <div className="max-w-sm w-full space-y-8">
                <h2 className="text-3xl font-bold tracking-tight text-black">大户交易守则</h2>
                <div className="text-sm text-gray-500 leading-relaxed space-y-4 font-medium">
                    <p>• 本系统仅供信息对等，严禁任何形式的站内直接交易。</p>
                    <p>• 发现虚假信息请联系：zqbzqb888@outlook.com。</p>
                    <p>• 点击同意即代表您已了解线下自提风险并自担责任。</p>
                </div>
                <button onClick={() => setHasAgreed(true)} className="w-full bg-black text-white py-5 rounded-3xl font-bold active:scale-95 transition-all shadow-2xl">确认知晓</button>
            </div>
        </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FBFBFD] text-[#1D1D1F] antialiased pb-20">
      {/* 顶部黑金滚动条 */}
      <div className="bg-black text-white py-2 overflow-hidden sticky top-0 z-50 shadow-lg">
        <div className="whitespace-nowrap animate-scroll inline-block text-[10px] font-bold tracking-[0.2em] opacity-90">
          REAL-TIME DATA MONITORING / 实时大厅已启动 / 线下核实 / 严禁欺诈 &nbsp;&nbsp;&nbsp;&nbsp; 
          SYSTEM STATUS: ONLINE / 交易请保留聊天凭证 / 已售信息请及时撤回
        </div>
      </div>

      <style jsx global>{`
        @keyframes scroll { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }
        .animate-scroll { animation: scroll 25s linear infinite; }
        .neon-sell:hover { box-shadow: 0 0 30px rgba(239, 68, 68, 0.1); border-color: rgba(239, 68, 68, 0.2) !important; }
        .neon-buy:hover { box-shadow: 0 0 30px rgba(59, 130, 246, 0.1); border-color: rgba(59, 130, 246, 0.2) !important; }
      `}</style>

      <main className="max-w-2xl mx-auto px-6 py-12">
        {/* 专业发布面板 */}
        <section className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-100 space-y-4 neon-sell transition-all">
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-black tracking-widest text-red-500">PRO SELL</span>
              <span className="text-[10px] text-gray-300">发布出售</span>
            </div>
            <input placeholder="价格 (元)" className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm" value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})} />
            <input placeholder="自提门店" className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm" value={formData.shop} onChange={e=>setFormData({...formData, shop:e.target.value})} />
            <input placeholder="商品全名" className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm" value={formData.item} onChange={e=>setFormData({...formData, item:e.target.value})} />
            <input placeholder="个人微信号" className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm" value={formData.contact} onChange={e=>setFormData({...formData, contact:e.target.value})} />
            <button onClick={()=>handlePublish('sell')} className="w-full bg-red-500 text-white py-4 rounded-2xl font-bold active:scale-95 transition-all shadow-xl shadow-red-50">立即上架</button>
          </div>

          <div className="bg-white rounded-[2.5rem] p-6 shadow-sm border border-gray-100 space-y-4 neon-buy transition-all">
            <div className="flex justify-between items-center px-1">
              <span className="text-[10px] font-black tracking-widest text-blue-500">PRO BUY</span>
              <span className="text-[10px] text-gray-300">发布求购</span>
            </div>
            <input placeholder="求购价" className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm" value={formData.price} onChange={e=>setFormData({...formData, price:e.target.value})} />
            <input placeholder="目标门店" className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm" value={formData.shop} onChange={e=>setFormData({...formData, shop:e.target.value})} />
            <input placeholder="求购商品" className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm" value={formData.item} onChange={e=>setFormData({...formData, item:e.target.value})} />
            <input placeholder="个人微信号" className="w-full p-4 bg-gray-50 rounded-2xl outline-none font-bold text-sm" value={formData.contact} onChange={e=>setFormData({...formData, contact:e.target.value})} />
            <button onClick={()=>handlePublish('buy')} className="w-full bg-blue-500 text-white py-4 rounded-2xl font-bold active:scale-95 transition-all shadow-xl shadow-blue-50">发布需求</button>
          </div>
        </section>

        {/* 拆分搜索控制台 */}
        <section className="mb-8 space-y-4">
          <div className="flex items-end justify-between px-2 mb-2">
            <h2 className="text-3xl font-bold tracking-tighter">实时大厅</h2>
            <div className="flex gap-4 text-[10px] font-black text-gray-400">
              <select className="bg-transparent outline-none cursor-pointer hover:text-black" onChange={e=>setFilterType(e.target.value)}>
                <option value="all">全部</option>
                <option value="sell">出售</option>
                <option value="buy">求购</option>
              </select>
              <select className="bg-transparent outline-none cursor-pointer hover:text-black" onChange={e=>setSortOrder(e.target.value)}>
                <option value="desc">价格降序</option>
                <option value="asc">价格升序</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <input 
              placeholder="🔍 搜门店 (杭州/上海...)" 
              className="flex-1 p-5 bg-white rounded-3xl shadow-sm border border-gray-50 outline-none focus:ring-1 focus:ring-black transition-all text-sm font-bold"
              value={searchStore}
              onChange={e => setSearchStore(e.target.value)}
            />
            <input 
              placeholder="📦 搜商品 (Labubu/Molly...)" 
              className="flex-1 p-5 bg-white rounded-3xl shadow-sm border border-gray-50 outline-none focus:ring-1 focus:ring-black transition-all text-sm font-bold"
              value={searchItem}
              onChange={e => setSearchItem(e.target.value)}
            />
          </div>
        </section>

        {/* 专业卡片流 */}
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
                <p className="text-gray-400 text-xs font-bold tracking-tight">{post.item}</p>
              </div>
              
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => {navigator.clipboard.writeText(post.contact); alert('微信号已复制到剪贴板');}}
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
            <div className="text-center py-24 text-gray-200 font-bold tracking-widest">NO DATA / 暂无专业数据</div>
          )}
        </div>
      </main>
    </div>
  );
}
