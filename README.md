# Kazanç Dünyası

Modern görev/puan platformu için Next.js + Supabase başlangıç projesi.

## İçindekiler
- Modern, mobil uyumlu arayüz
- Supabase Auth ile e-posta/parola kayıt ve giriş
- PostgreSQL profiller, görevler, tamamlamalar ve puan defteri
- RLS politikaları
- Puanı istemciden almayan Edge Function
- Admin rolüne özel görev ekleme arayüzü
- Kurulum, test ve yayınlama yönergeleri

## Gereksinimler
- Node.js 20+
- Supabase projesi
- Supabase CLI (Edge Function dağıtımı için)

## Yerelde çalıştırma
1. Paketi açın.
2. `npm install`
3. `.env.example` dosyasını `.env.local` olarak kopyalayın ve Supabase URL/anon key alanlarını doldurun.
4. Supabase SQL Editor içinde `supabase/migrations/001_initial.sql` dosyasını çalıştırın.
5. `npm run dev` ile geliştirme sunucusunu başlatın.
6. `http://localhost:3000` adresini açın.

## Edge Function dağıtımı
Supabase CLI ile projeye bağlandıktan sonra:
```bash
supabase functions deploy complete-task
supabase secrets set ALLOWED_ORIGIN=https://SIZIN-DOMAININIZ
```
Function'ın Supabase tarafından sağlanan `SUPABASE_URL`, `SUPABASE_ANON_KEY` ve `SUPABASE_SERVICE_ROLE_KEY` secret'larına erişimi olmalıdır. Service-role key hiçbir zaman tarayıcıya veya Git deposuna konulmamalıdır.

## İlk yöneticiyi atama
Normal kayıtlar varsayılan olarak `user` rolü alır. İlk admin rolünü yalnızca Supabase Dashboard SQL Editor gibi güvenilir yönetim kanalından atayın:
```sql
update public.profiles
set role = 'admin'
where id = (select id from auth.users where email = 'SIZIN_YONETICI_EPOSTANIZ');
```
Kullanıcı arayüzünden admin olma özelliği yoktur.

## Yayınlama
- Git deposuna `.env.local` veya service-role key göndermeyin.
- Vercel'de yeni proje oluşturup depoyu bağlayın.
- `NEXT_PUBLIC_SUPABASE_URL` ve `NEXT_PUBLIC_SUPABASE_ANON_KEY` ortam değişkenlerini ekleyin.
- Supabase Auth > URL Configuration bölümünde gerçek site URL'sini ve yönlendirme URL'lerini tanımlayın.
- Supabase SQL migration'ını ve Edge Function'ı dağıtın.
- HTTPS, e-posta doğrulaması, güçlü parola politikası, rate limit, yedekleme ve log izlemeyi etkinleştirin.
- Canlıya çıkmadan önce ayrı bir test hesabıyla kayıt, giriş, görev tamamlama, tekrar deneme, yetkisiz admin erişimi ve RLS kontrollerini yapın.

## Güvenlik notları ve yapılması gerekenler
- Bu başlangıç projesi temel güvenlik kontrolleri içerir; bağımsız güvenlik denetimi yapılmadan gerçek ödül/para ödemesi için kullanmayın.
- Görev puanları sadece veritabanındaki görev kaydından alınır. Tekrar tamamlama unique constraint ile engellenir.
- Üretimde bakiye güncelleme ve ledger yazımı tek bir PostgreSQL transaction/RPC içinde yapılmalıdır. Bu örnek Edge Function'da işlemler ardışık ve telafi adımlıdır; yüksek trafik veya gerçek değerli puanlar için atomik RPC'ye yükseltin.
- Görevlerin gerçekten yapıldığını doğrulayacak kanıt/inceleme akışı henüz tanımlı değildir. Ödüllü görevleri otomatik onaylamadan önce kötüye kullanım incelemesi ekleyin.
- Kullanıcı profili ve görev ekranları için RLS uygulanmıştır. SQL politikalarını staging ortamında test edin.
- Gizlilik bildirimi, kullanım şartları, veri saklama/silme süreçleri ve yaşa uygun tasarım yayına çıkmadan önce hukuk ve güvenlik uzmanlarınca gözden geçirilmelidir.
- Reşit olmayan kullanıcılar için gerçek para ödülü, ödeme/çekim ve finansal hesap özellikleri etkinleştirilmemiştir. Bu pakette ödeme entegrasyonu yoktur.
- Gerçek para/ödül sunulacaksa yerel mevzuat, vergi, tüketici hakları, promosyon/çekiliş kuralları, ödeme sağlayıcısı şartları ve yaş kısıtları uzmanlarla değerlendirilmelidir.

## Test senaryoları
1. Yeni kullanıcı kayıt olur; profil otomatik oluşur.
2. Giriş yapmadan görev tamamlama isteği 401 döner.
3. Aktif görev, veritabanındaki puanıyla tamamlanır.
4. Aynı kullanıcı aynı görevi ikinci kez tamamlayamaz (409).
5. İstek gövdesine sahte `points` eklense bile sunucu bu değeri kullanmaz.
6. Kullanıcı başka bir kullanıcının profilini/ledger kaydını okuyamaz.
7. Normal kullanıcı admin sekmesini göremez ve görev ekleyemez.
8. Admin görev ekleyebilir.
9. Oturum kapatılınca korumalı veriler görünmez.

## Sınırlar
Bu paket yapılandırılabilir bir uygulama başlangıcıdır; Supabase/Vercel hesaplarına bağlanıp sizin adınıza kaynak oluşturmaz veya siteyi internete yayınlamaz. Alan adı, gerçek hesaplar, e-posta gönderimi ve yasal metinler kullanıcı/işletme tarafından tamamlanmalıdır.
