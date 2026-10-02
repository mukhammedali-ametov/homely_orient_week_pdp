# encoding: utf-8
# Homely lokal server: sahifalar + buyurtma, kirish, admin.
require 'webrick'
require 'json'
require 'securerandom'
require 'socket'
require 'time'
require 'date'
require 'fileutils'

ROOT = File.expand_path(__dir__)
DATA_DIR = File.join(ROOT, 'data')
DB_PATH = File.join(DATA_DIR, 'db.json')
PORT = 8080
MUTEX = Mutex.new

module HomelyApp
  STATUSES = %w[qabul qadoq jonatildi yetib].freeze
  STATUS_NAME = {
    'qabul' => 'Qabul qilindi',
    'qadoq' => 'Qadoqlandi',
    'jonatildi' => "Jo'natildi",
    'yetib' => 'Yetib bordi'
  }.freeze

  BOXES = [
    {
      'id' => 'standart',
      'name' => 'Standart quti',
      'tag' => "Uy ta'mi",
      'price' => 350_000,
      'weight' => '1.2 kg',
      'image' => 'assets/box-standart.jpg',
      'lead' => "Mayiz, turshak, o'rik qoqi, yong'oq, holva, novvot va o'zbek choyi.",
      'items' => ['Mayiz', 'Turshak', "O'rik qoqi", "Yong'oq", 'Holva', 'Novvot', "O'zbek choyi"]
    },
    {
      'id' => 'premium',
      'name' => 'Premium quti',
      'tag' => 'Keng dasturxon',
      'price' => 480_000,
      'weight' => '1.8 kg',
      'image' => 'assets/box-premium.jpg',
      'lead' => "Yirikroq quti: premium yong'oq, asalda turshak, holva, novvot, ko'k va qora choy.",
      'items' => ["Premium yong'oq", 'Bodom', 'Asalda turshak', 'Holva', 'Novvot', "Ko'k choy", 'Qora choy', "Quritilgan o'rik"]
    },
    {
      'id' => 'bayram',
      'name' => 'Bayram qutisi',
      'tag' => 'Yangi yil · Navro\'z · Hayit',
      'price' => 420_000,
      'weight' => '1.4 kg',
      'image' => 'assets/box-bayram.jpg',
      'lead' => "Bayram bezagi, quruq mevalar, holva, novvot, choy va tabrik xati.",
      'items' => ['Bayram bezagi', 'Quruq mevalar', 'Holva', 'Novvot', 'Choy', 'Tabrik xati']
    },
    {
      'id' => 'ozim',
      'name' => "O'zim topshiraman",
      'tag' => 'Sizning narsangiz',
      'price' => 80_000,
      'weight' => 'Siz olib kelasiz',
      'image' => 'assets/box-ozim.jpg',
      'lead' => "O'z mahsulotingizni olib kelasiz. Biz sovg'a qutiga joylaymiz, xabar va QR qo'shamiz.",
      'items' => ["Qadoqlash", 'Shaxsiy xabar', 'QR sahifa', 'Jo\'natishni muvofiqlashtirish']
    }
  ].freeze

  ROUTES = [
    { 'id' => 'moskva', 'country' => 'Rossiya', 'city' => 'Moskva', 'delivery' => 85_000, 'days' => '7–10 kun' },
    { 'id' => 'piter', 'country' => 'Rossiya', 'city' => 'Sankt-Peterburg', 'delivery' => 95_000, 'days' => '8–12 kun' },
    { 'id' => 'qozon', 'country' => 'Rossiya', 'city' => 'Qozon', 'delivery' => 90_000, 'days' => '8–12 kun' },
    { 'id' => 'novosibirsk', 'country' => 'Rossiya', 'city' => 'Novosibirsk', 'delivery' => 110_000, 'days' => '9–14 kun' },
    { 'id' => 'seul', 'country' => 'Janubiy Koreya', 'city' => 'Seul', 'delivery' => 160_000, 'days' => '10–16 kun' }
  ].freeze

  SENDER_CITIES = ['Samarqand', 'Toshkent', 'Andijon', "Farg'ona", 'Namangan', 'Buxoro', 'Xorazm', 'Navoiy', 'Qarshi', 'Nukus'].freeze

  def self.shipping_dates
    today = Date.today
    ahead = (5 - today.wday) % 7
    ahead = 7 if ahead.zero?
    first = today + ahead
    (0..5).map { |i| (first + (i * 7)).strftime('%Y-%m-%d') }
  end

  def self.ago(days)
    (Time.now.utc - (days * 86_400)).iso8601
  end

  def self.seed_db
    ship = shipping_dates[0]
    {
      'users' => [
        {
          'id' => 'u-zulfiya',
          'name' => 'Zulfiya Karimova',
          'phone' => '+998 90 555 12 34',
          'city' => 'Samarqand',
          'login' => 'zulfiya',
          'password' => 'mehr2026',
          'role' => 'user'
        },
        {
          'id' => 'u-admin',
          'name' => 'Homely Admin',
          'phone' => '+998 71 200 00 00',
          'city' => 'Toshkent',
          'login' => 'admin',
          'password' => 'homely2026',
          'role' => 'admin'
        }
      ],
      'sessions' => {},
      'orders' => [
        {
          'id' => 'o-10428',
          'number' => 'HM-10428',
          'userId' => 'u-zulfiya',
          'boxId' => 'standart',
          'boxName' => 'Standart quti',
          'boxPrice' => 350_000,
          'senderName' => 'Zulfiya Karimova',
          'senderPhone' => '+998 90 555 12 34',
          'senderCity' => 'Samarqand',
          'recipientName' => 'Sardor Karimov',
          'country' => 'Rossiya',
          'city' => 'Moskva',
          'routeId' => 'moskva',
          'shipDate' => ship,
          'deliveryDays' => '7–10 kun',
          'messageText' => "O'g'lim, seni sog'indik. Bu mayizni o'zimiz tayyorladik. Choy damlab, bizni esla.",
          'messagePhoto' => nil,
          'messageAudio' => nil,
          'customNote' => nil,
          'deliveryPrice' => 85_000,
          'total' => 435_000,
          'cardLast4' => '9012',
          'cardName' => 'ZULFIYA KARIMOVA',
          'status' => 'jonatildi',
          'token' => 'mehr1042',
          'replyText' => nil,
          'replyPhoto' => nil,
          'replyAt' => nil,
          'createdAt' => ago(6),
          'history' => [
            { 'status' => 'qabul', 'at' => ago(6) },
            { 'status' => 'qadoq', 'at' => ago(5) },
            { 'status' => 'jonatildi', 'at' => ago(3) }
          ]
        },
        {
          'id' => 'o-10411',
          'number' => 'HM-10411',
          'userId' => nil,
          'boxId' => 'bayram',
          'boxName' => 'Bayram qutisi',
          'boxPrice' => 420_000,
          'senderName' => 'Dilnoza Rasulova',
          'senderPhone' => '+998 91 222 18 40',
          'senderCity' => 'Andijon',
          'recipientName' => 'Jasur Rasulov',
          'country' => 'Rossiya',
          'city' => 'Sankt-Peterburg',
          'routeId' => 'piter',
          'shipDate' => ship,
          'deliveryDays' => '8–12 kun',
          'messageText' => "Jasurjon, hayiting muborak bo'lsin. Uydagilar sog'inadi.",
          'messagePhoto' => nil,
          'messageAudio' => nil,
          'customNote' => nil,
          'deliveryPrice' => 95_000,
          'total' => 515_000,
          'cardLast4' => '4410',
          'cardName' => 'DILNOZA RASULOVA',
          'status' => 'qadoq',
          'token' => 'bayram771',
          'replyText' => nil,
          'replyPhoto' => nil,
          'replyAt' => nil,
          'createdAt' => ago(2),
          'history' => [
            { 'status' => 'qabul', 'at' => ago(2) },
            { 'status' => 'qadoq', 'at' => ago(1) }
          ]
        },
        {
          'id' => 'o-10390',
          'number' => 'HM-10390',
          'userId' => nil,
          'boxId' => 'premium',
          'boxName' => 'Premium quti',
          'boxPrice' => 480_000,
          'senderName' => 'Malika Tursunova',
          'senderPhone' => '+998 97 410 77 21',
          'senderCity' => 'Toshkent',
          'recipientName' => 'Akmal Tursunov',
          'country' => 'Janubiy Koreya',
          'city' => 'Seul',
          'routeId' => 'seul',
          'shipDate' => (Date.today - 12).strftime('%Y-%m-%d'),
          'deliveryDays' => '10–16 kun',
          'messageText' => "Akmaljon, Seulda ham uy choyini ich. Sog'inamiz.",
          'messagePhoto' => nil,
          'messageAudio' => nil,
          'customNote' => nil,
          'deliveryPrice' => 160_000,
          'total' => 640_000,
          'cardLast4' => '2281',
          'cardName' => 'MALIKA TURSUNOVA',
          'status' => 'yetib',
          'token' => 'seul2201',
          'replyText' => "Onajon, quti yetib keldi. Choy judayam totli, sog'indim.",
          'replyPhoto' => nil,
          'replyAt' => ago(1),
          'createdAt' => ago(18),
          'history' => [
            { 'status' => 'qabul', 'at' => ago(18) },
            { 'status' => 'qadoq', 'at' => ago(17) },
            { 'status' => 'jonatildi', 'at' => ago(14) },
            { 'status' => 'yetib', 'at' => ago(1) }
          ]
        }
      ],
      'contacts' => [
        {
          'id' => 'c-1',
          'name' => 'Nodira Yusupova',
          'phone' => '+998 93 777 45 10',
          'message' => "Assalomu alaykum. Onam o'g'liga Moskvaga quti yubormoqchi. Qancha kunda yetadi?",
          'at' => ago(1),
          'read' => false
        }
      ],
      'notifications' => [
        {
          'id' => 'n-1',
          'userId' => 'u-zulfiya',
          'text' => "Sardorning qutisi yo'lga chiqdi. Holat: Jo'natildi.",
          'at' => ago(3),
          'read' => false
        }
      ],
      'seq' => 10_500
    }
  end

  def self.load_db
    FileUtils.mkdir_p(DATA_DIR)
    unless File.exist?(DB_PATH)
      File.write(DB_PATH, JSON.pretty_generate(seed_db))
    end
    JSON.parse(File.read(DB_PATH, encoding: 'UTF-8'))
  end

  def self.save_db(db)
    FileUtils.mkdir_p(DATA_DIR)
    File.write(DB_PATH, JSON.pretty_generate(db))
  end

  def self.with_db(write: false)
    MUTEX.synchronize do
      db = load_db
      result = yield db
      save_db(db) if write
      result
    end
  end

  def self.lan_ip
    list = Socket.ip_address_list.select { |a| a.ipv4? && !a.ipv4_loopback? }
    picked = list.find(&:ipv4_private?) || list.first
    picked&.ip_address
  end

  def self.base_url
    ip = lan_ip || '127.0.0.1'
    "http://#{ip}:#{PORT}"
  end

  def self.public_user(user)
    return nil unless user
    {
      'id' => user['id'],
      'name' => user['name'],
      'phone' => user['phone'],
      'city' => user['city'],
      'login' => user['login'],
      'role' => user['role']
    }
  end

  def self.current_user(db, req)
    token = req.header['x-session']&.first.to_s
    return nil if token.empty?
    sess = db['sessions'][token]
    return nil unless sess
    db['users'].find { |u| u['id'] == sess['userId'] }
  end

  def self.order_client(order, full: false)
    data = {
      'id' => order['id'],
      'number' => order['number'],
      'boxId' => order['boxId'],
      'boxName' => order['boxName'],
      'boxPrice' => order['boxPrice'],
      'senderName' => order['senderName'],
      'senderCity' => order['senderCity'],
      'recipientName' => order['recipientName'],
      'country' => order['country'],
      'city' => order['city'],
      'shipDate' => order['shipDate'],
      'deliveryDays' => order['deliveryDays'],
      'deliveryPrice' => order['deliveryPrice'],
      'total' => order['total'],
      'status' => order['status'],
      'createdAt' => order['createdAt'],
      'history' => order['history'],
      'replyText' => order['replyText'],
      'replyAt' => order['replyAt'],
      'customNote' => order['customNote']
    }
    if full
      data['senderPhone'] = order['senderPhone']
      data['messageText'] = order['messageText']
      data['messagePhoto'] = order['messagePhoto']
      data['messageAudio'] = order['messageAudio']
      data['replyPhoto'] = order['replyPhoto']
      data['token'] = order['token']
      data['cardLast4'] = order['cardLast4']
      data['userId'] = order['userId']
    end
    data
  end

  def self.notify(db, user_id, text)
    return if user_id.nil? || user_id.to_s.empty?
    db['notifications'].unshift(
      'id' => 'n-' + SecureRandom.hex(4),
      'userId' => user_id,
      'text' => text,
      'at' => Time.now.utc.iso8601,
      'read' => false
    )
    db['notifications'] = db['notifications'].first(40)
  end

  def self.dispatch(req, res)
    path = req.path
    if path.start_with?('/api/')
      api(req, res, path)
    else
      serve_file(req, res, path)
    end
  rescue StandardError => e
    warn "Xato: #{e.class}: #{e.message}"
    json(res, { 'error' => 'Serverda kutilmagan xato. Qayta urinib ko\'ring.' }, 500)
  end

  def self.api(req, res, path)
    method = req.request_method
    if method == 'GET' && path == '/api/health'
      return json(res, { 'ok' => true })
    end

    if method == 'GET' && path == '/api/bootstrap'
      return with_db do |db|
        user = current_user(db, req)
        notes = []
        if user
          notes = db['notifications'].select { |n| n['userId'] == user['id'] }.first(15)
        end
        json(res, {
          'user' => public_user(user),
          'boxes' => BOXES,
          'routes' => ROUTES,
          'dates' => shipping_dates,
          'senderCities' => SENDER_CITIES,
          'notifications' => notes,
          'baseUrl' => base_url,
          'localUrl' => "http://127.0.0.1:#{PORT}"
        })
      end
    end

    if method == 'POST' && path == '/api/login'
      body = read_json(req)
      return json(res, { 'error' => "Ma'lumot formati noto'g'ri" }, 400) unless body
      login = body['login'].to_s.strip.downcase
      password = body['password'].to_s
      return with_db(write: true) do |db|
        user = db['users'].find { |u| u['login'].downcase == login && u['password'] == password }
        unless user
          json(res, { 'error' => "Login yoki parol noto'g'ri" }, 401)
          next
        end
        token = SecureRandom.hex(16)
        db['sessions'][token] = { 'userId' => user['id'], 'at' => Time.now.utc.iso8601 }
        json(res, { 'token' => token, 'user' => public_user(user) })
      end
    end

    if method == 'POST' && path == '/api/logout'
      token = req.header['x-session']&.first.to_s
      return with_db(write: true) do |db|
        db['sessions'].delete(token)
        json(res, { 'ok' => true })
      end
    end

    if method == 'POST' && path == '/api/register'
      body = read_json(req)
      return json(res, { 'error' => "Ma'lumot formati noto'g'ri" }, 400) unless body
      name = body['name'].to_s.strip
      phone = body['phone'].to_s.strip
      city = body['city'].to_s.strip
      login = body['login'].to_s.strip.downcase
      password = body['password'].to_s
      if name.length < 3
        return json(res, { 'error' => 'Ismingizni to\'liq yozing' }, 400)
      end
      if phone.gsub(/\D/, '').length < 9
        return json(res, { 'error' => "Telefon raqamini to'liq yozing" }, 400)
      end
      if login.length < 3 || login !~ /\A[a-z0-9._]+\z/
        return json(res, { 'error' => 'Login kamida 3 ta harf yoki raqam bo\'lsin' }, 400)
      end
      if password.length < 4
        return json(res, { 'error' => "Parol kamida 4 ta belgi bo'lsin" }, 400)
      end
      return with_db(write: true) do |db|
        if db['users'].any? { |u| u['login'].downcase == login }
          json(res, { 'error' => 'Bu login band. Boshqasini tanlang.' }, 400)
          next
        end
        user = {
          'id' => 'u-' + SecureRandom.hex(4),
          'name' => name,
          'phone' => phone,
          'city' => city.empty? ? 'Samarqand' : city,
          'login' => login,
          'password' => password,
          'role' => 'user'
        }
        db['users'] << user
        token = SecureRandom.hex(16)
        db['sessions'][token] = { 'userId' => user['id'], 'at' => Time.now.utc.iso8601 }
        json(res, { 'token' => token, 'user' => public_user(user) })
      end
    end

    if method == 'GET' && path == '/api/orders'
      return with_db do |db|
        user = current_user(db, req)
        unless user
          json(res, { 'error' => 'Avval kiring' }, 401)
          next
        end
        list = if user['role'] == 'admin'
                 db['orders']
               else
                 db['orders'].select { |o| o['userId'] == user['id'] }
               end
        list = list.sort_by { |o| o['createdAt'].to_s }.reverse
        json(res, { 'orders' => list.map { |o| order_client(o, full: true) } })
      end
    end

    if method == 'POST' && path == '/api/orders'
      body = read_json(req)
      return json(res, { 'error' => "Ma'lumot formati noto'g'ri" }, 400) unless body
      box = BOXES.find { |b| b['id'] == body['boxId'].to_s }
      route = ROUTES.find { |r| r['id'] == body['routeId'].to_s }
      return json(res, { 'error' => 'Qutini tanlang' }, 400) unless box
      return json(res, { 'error' => 'Shaharni tanlang' }, 400) unless route
      unless shipping_dates.include?(body['shipDate'].to_s)
        return json(res, { 'error' => "Jo'natish sanasini tanlang" }, 400)
      end
      recipient = body['recipientName'].to_s.strip
      return json(res, { 'error' => 'Qabul qiluvchining ismini yozing' }, 400) if recipient.length < 2
      message = body['messageText'].to_s.strip
      return json(res, { 'error' => 'Mehr xabarini yozing' }, 400) if message.length < 3
      return json(res, { 'error' => 'Xabar juda uzun' }, 400) if message.length > 800
      custom = body['customNote'].to_s.strip
      custom = nil if custom.empty?
      if box['id'] == 'ozim' && (custom.nil? || custom.length < 3)
        return json(res, { 'error' => "Nima topshirayotganingizni qisqa yozing" }, 400)
      end
      sender_name = body['senderName'].to_s.strip
      sender_phone = body['senderPhone'].to_s.strip
      sender_city = body['senderCity'].to_s.strip
      return json(res, { 'error' => 'Yuboruvchi ismini yozing' }, 400) if sender_name.length < 3
      if sender_phone.gsub(/\D/, '').length < 9
        return json(res, { 'error' => "Telefon raqamini to'liq yozing" }, 400)
      end
      card_digits = body['cardNumber'].to_s.gsub(/\D/, '')
      expiry = body['expiry'].to_s.strip
      cvv = body['cvv'].to_s.gsub(/\D/, '')
      card_name = body['cardName'].to_s.strip
      return json(res, { 'error' => "Karta raqami 16 ta raqam bo'lsin" }, 400) unless card_digits.length == 16
      return json(res, { 'error' => "Muddat MM/YY ko'rinishida bo'lsin" }, 400) unless expiry =~ /\A(0[1-9]|1[0-2])\/\d{2}\z/
      return json(res, { 'error' => 'CVV 3 ta raqam' }, 400) unless cvv.length == 3
      return json(res, { 'error' => 'Karta egasining ismini yozing' }, 400) if card_name.length < 3
      photo = clean_media(body['messagePhoto'], 'image')
      audio = clean_media(body['messageAudio'], 'audio')
      return json(res, { 'error' => photo }, 400) if photo.is_a?(String) && photo.start_with?('ERR:')
      return json(res, { 'error' => audio }, 400) if audio.is_a?(String) && audio.start_with?('ERR:')
      return with_db(write: true) do |db|
        user = current_user(db, req)
        db['seq'] = db['seq'].to_i + 1
        number = format('HM-%05d', db['seq'])
        now = Time.now.utc.iso8601
        order = {
          'id' => 'o-' + SecureRandom.hex(4),
          'number' => number,
          'userId' => user && user['role'] == 'user' ? user['id'] : (user ? user['id'] : nil),
          'boxId' => box['id'],
          'boxName' => box['name'],
          'boxPrice' => box['price'],
          'senderName' => sender_name,
          'senderPhone' => sender_phone,
          'senderCity' => sender_city.empty? ? 'Samarqand' : sender_city,
          'recipientName' => recipient,
          'country' => route['country'],
          'city' => route['city'],
          'routeId' => route['id'],
          'shipDate' => body['shipDate'],
          'deliveryDays' => route['days'],
          'messageText' => message,
          'messagePhoto' => photo,
          'messageAudio' => audio,
          'customNote' => custom,
          'deliveryPrice' => route['delivery'],
          'total' => box['price'] + route['delivery'],
          'cardLast4' => card_digits[-4, 4],
          'cardName' => card_name,
          'status' => 'qabul',
          'token' => SecureRandom.hex(4),
          'replyText' => nil,
          'replyPhoto' => nil,
          'replyAt' => nil,
          'createdAt' => now,
          'history' => [{ 'status' => 'qabul', 'at' => now }]
        }
        if user && user['role'] == 'admin'
          order['userId'] = nil
        end
        db['orders'].unshift(order)
        if order['userId']
          notify(db, order['userId'], "#{number} qabul qilindi. #{recipient} uchun #{box['name']} tayyorlanadi.")
        end
        json(res, { 'order' => order_client(order, full: true) })
      end
    end

    if method == 'POST' && path == '/api/status'
      body = read_json(req)
      return json(res, { 'error' => "Ma'lumot formati noto'g'ri" }, 400) unless body
      status = body['status'].to_s
      return json(res, { 'error' => "Noto'g'ri holat" }, 400) unless STATUSES.include?(status)
      return with_db(write: true) do |db|
        user = current_user(db, req)
        unless user && user['role'] == 'admin'
          json(res, { 'error' => 'Faqat admin holatni o\'zgartiradi' }, 403)
          next
        end
        order = db['orders'].find { |o| o['id'] == body['id'].to_s }
        unless order
          json(res, { 'error' => 'Buyurtma topilmadi' }, 404)
          next
        end
        unless order['status'] == status
          now = Time.now.utc.iso8601
          order['status'] = status
          order['history'] << { 'status' => status, 'at' => now }
          notify(db, order['userId'], "#{order['number']}: #{STATUS_NAME[status]}.")
          if status == 'yetib'
            notify(db, order['userId'], "Yetib keldi. #{order['recipientName']} qutini oldi.")
          end
        end
        json(res, { 'order' => order_client(order, full: true) })
      end
    end

    if method == 'GET' && path == '/api/track'
      number = req.query['number'].to_s.strip.upcase
      number = number.sub(/\AHM(?=\d)/, 'HM-')
      number = 'HM-' + number if number =~ /\A\d+\z/
      return with_db do |db|
        order = db['orders'].find { |o| o['number'].upcase == number }
        unless order
          json(res, { 'error' => "Bunday buyurtma yo'q. Raqamni tekshiring." }, 404)
          next
        end
        user = current_user(db, req)
        full = user && (user['role'] == 'admin' || user['id'] == order['userId'])
        json(res, { 'order' => order_client(order, full: full) })
      end
    end

    if method == 'GET' && path == '/api/xabar'
      token = req.query['t'].to_s
      return with_db do |db|
        order = db['orders'].find { |o| o['token'] == token }
        unless order
          json(res, { 'error' => "Bu havola topilmadi. QR qutidagi shaxsiy kod bo'lishi kerak." }, 404)
          next
        end
        json(res, {
          'senderName' => order['senderName'],
          'senderCity' => order['senderCity'],
          'recipientName' => order['recipientName'],
          'messageText' => order['messageText'],
          'messagePhoto' => order['messagePhoto'],
          'messageAudio' => order['messageAudio'],
          'boxName' => order['boxName'],
          'city' => order['city'],
          'country' => order['country'],
          'status' => order['status'],
          'history' => order['history'],
          'replyText' => order['replyText'],
          'replyPhoto' => order['replyPhoto'],
          'shipDate' => order['shipDate'],
          'number' => order['number']
        })
      end
    end

    if method == 'POST' && path == '/api/reply'
      body = read_json(req)
      return json(res, { 'error' => "Ma'lumot formati noto'g'ri" }, 400) unless body
      text = body['text'].to_s.strip
      return json(res, { 'error' => 'Javob yozing' }, 400) if text.length < 2
      return json(res, { 'error' => 'Javob juda uzun' }, 400) if text.length > 800
      photo = clean_media(body['photo'], 'image')
      return json(res, { 'error' => photo }, 400) if photo.is_a?(String) && photo.start_with?('ERR:')
      return with_db(write: true) do |db|
        order = db['orders'].find { |o| o['token'] == body['token'].to_s }
        unless order
          json(res, { 'error' => 'Havola topilmadi' }, 404)
          next
        end
        if order['replyText'] && !order['replyText'].to_s.empty?
          json(res, { 'error' => 'Javob allaqachon yuborilgan' }, 400)
          next
        end
        now = Time.now.utc.iso8601
        order['replyText'] = text
        order['replyPhoto'] = photo
        order['replyAt'] = now
        unless order['status'] == 'yetib'
          order['status'] = 'yetib'
          order['history'] << { 'status' => 'yetib', 'at' => now }
        end
        notify(db, order['userId'], "Yetib keldi. #{order['recipientName']} javob yubordi.")
        json(res, { 'ok' => true, 'replyText' => text })
      end
    end

    if method == 'POST' && path == '/api/contact'
      body = read_json(req)
      return json(res, { 'error' => "Ma'lumot formati noto'g'ri" }, 400) unless body
      name = body['name'].to_s.strip
      phone = body['phone'].to_s.strip
      message = body['message'].to_s.strip
      return json(res, { 'error' => 'Ismingizni yozing' }, 400) if name.length < 2
      return json(res, { 'error' => 'Telefonni yozing' }, 400) if phone.gsub(/\D/, '').length < 9
      return json(res, { 'error' => 'Xabarni yozing' }, 400) if message.length < 5
      return with_db(write: true) do |db|
        db['contacts'].unshift(
          'id' => 'c-' + SecureRandom.hex(3),
          'name' => name,
          'phone' => phone,
          'message' => message[0, 800],
          'at' => Time.now.utc.iso8601,
          'read' => false
        )
        json(res, { 'ok' => true })
      end
    end

    if method == 'GET' && path == '/api/admin'
      return with_db do |db|
        user = current_user(db, req)
        unless user && user['role'] == 'admin'
          json(res, { 'error' => 'Faqat admin ko\'ra oladi' }, 403)
          next
        end
        orders = db['orders'].sort_by { |o| o['createdAt'].to_s }.reverse
        users = db['users'].map do |u|
          public_user(u).merge('orders' => db['orders'].count { |o| o['userId'] == u['id'] })
        end
        json(res, {
          'orders' => orders.map { |o| order_client(o, full: true) },
          'contacts' => db['contacts'],
          'users' => users
        })
      end
    end

    if method == 'POST' && path == '/api/read'
      return with_db(write: true) do |db|
        user = current_user(db, req)
        unless user
          json(res, { 'error' => 'Avval kiring' }, 401)
          next
        end
        db['notifications'].each do |n|
          n['read'] = true if n['userId'] == user['id']
        end
        json(res, { 'ok' => true })
      end
    end

    if method == 'POST' && path == '/api/reset'
      token = req.header['x-session']&.first.to_s
      return with_db(write: true) do |db|
        user = current_user(db, req)
        unless user && user['role'] == 'admin'
          json(res, { 'error' => 'Faqat admin tiklay oladi' }, 403)
          next
        end
        fresh = seed_db
        fresh['sessions'][token] = { 'userId' => 'u-admin', 'at' => Time.now.utc.iso8601 }
        db.replace(fresh)
        json(res, { 'ok' => true })
      end
    end

    json(res, { 'error' => 'Topilmadi' }, 404)
  end

  def self.clean_media(value, kind)
    return nil if value.nil? || value.to_s.strip.empty?
    text = value.to_s
    if kind == 'image'
      return 'ERR:Rasm formati noto\'g\'ri' unless text.start_with?('data:image/jpeg', 'data:image/png', 'data:image/webp')
      return 'ERR:Rasm juda katta. Kichikroq rasm tanlang.' if text.length > 900_000
    else
      return 'ERR:Ovoz formati noto\'g\'ri' unless text.start_with?('data:audio/')
      return 'ERR:Ovoz juda uzun. Qisqaroq yozing.' if text.length > 900_000
    end
    text
  end

  def self.read_json(req)
    raw = req.body.to_s
    return {} if raw.strip.empty?
    JSON.parse(raw)
  rescue JSON::ParserError
    nil
  end

  def self.json(res, obj, status = 200)
    res.status = status
    res['Content-Type'] = 'application/json; charset=utf-8'
    res['Cache-Control'] = 'no-store'
    res.body = JSON.generate(obj)
  end

  def self.serve_file(req, res, path)
    rel = WEBrick::HTTPUtils.unescape(path.to_s.split('?').first)
    rel = 'index.html' if rel == '/' || rel.empty?
    rel = rel.sub(%r{\A/+}, '')
    if rel.start_with?('data/', 'data') || rel == 'server.rb' || rel.end_with?('.command')
      return not_found(res)
    end
    full = File.expand_path(rel, ROOT)
    root_prefix = ROOT.end_with?(File::SEPARATOR) ? ROOT : ROOT + File::SEPARATOR
    return not_found(res) unless full == ROOT || full.start_with?(root_prefix)
    full = File.join(full, 'index.html') if File.directory?(full)
    return not_found(res) unless File.file?(full)
    ext = File.extname(full).downcase
    type = {
      '.html' => 'text/html; charset=utf-8',
      '.css' => 'text/css; charset=utf-8',
      '.js' => 'text/javascript; charset=utf-8',
      '.svg' => 'image/svg+xml',
      '.jpg' => 'image/jpeg',
      '.jpeg' => 'image/jpeg',
      '.png' => 'image/png',
      '.webp' => 'image/webp'
    }[ext] || 'application/octet-stream'
    res.status = 200
    res['Content-Type'] = type
    res['Cache-Control'] = ext == '.html' || ext == '.js' || ext == '.css' ? 'no-cache' : 'public, max-age=3600'
    res.body = File.binread(full)
  end

  def self.not_found(res)
    res.status = 404
    res['Content-Type'] = 'text/html; charset=utf-8'
    res.body = '<!doctype html><meta charset="utf-8"><title>Topilmadi</title><p>Sahifa topilmadi. <a href="/">Bosh sahifa</a></p>'
  end
end

ip = HomelyApp.lan_ip
puts ''
puts '  Homely ishga tushdi'
puts "  Kompyuter:  http://127.0.0.1:#{PORT}"
puts "  Telefon:    http://#{ip}:#{PORT}" if ip
puts ''
puts '  Foydalanuvchi:  zulfiya / mehr2026'
puts '  Admin:          admin / homely2026'
puts ''
puts '  To\'xtatish: Ctrl+C'
puts ''

class HomelyServlet < WEBrick::HTTPServlet::AbstractServlet
  def do_GET(req, res)
    HomelyApp.dispatch(req, res)
  end

  def do_POST(req, res)
    HomelyApp.dispatch(req, res)
  end
end

server = WEBrick::HTTPServer.new(
  Port: PORT,
  BindAddress: '0.0.0.0',
  Logger: WEBrick::Log.new($stdout, WEBrick::Log::INFO),
  AccessLog: [[$stdout, WEBrick::AccessLog::COMMON_LOG_FORMAT]]
)
server.mount '/', HomelyServlet
trap('INT') { server.shutdown }
server.start
