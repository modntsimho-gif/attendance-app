// public/sw.js

self.addEventListener("push", function (event) {
    if (event.data) {
      const data = event.data.json();
      
      const options = {
        body: data.body,
        icon: "/icon-192x192.png", // PWA 세팅할 때 쓰신 아이콘 경로로 맞춰주세요
        badge: "/icon-192x192.png",
        vibrate: [200, 100, 200], // 알림 올 때 진동 패턴
        data: {
          url: data.url || "/", // 알림 클릭 시 이동할 주소
        },
      };
  
      event.waitUntil(
        self.registration.showNotification(data.title, options)
      );
    }
  });
  
  // 알림을 클릭했을 때의 동작
  self.addEventListener("notificationclick", function (event) {
    event.notification.close();
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  });
  

  // 1. 서버에서 푸시 알림이 날아왔을 때 발생하는 이벤트
self.addEventListener("push", function (event) {
    if (!event.data) return;
  
    try {
      // 서버(push.ts)에서 보낸 JSON 데이터를 파싱합니다.
      const data = event.data.json();
  
      // 알림창에 보여줄 옵션 설정
      const options = {
        body: data.body,
        icon: "/icon-192x192.png", // ⭐️ public 폴더에 있는 앱 아이콘 경로로 맞춰주세요
        badge: "/icon-192x192.png", // 안드로이드 상태바에 작게 표시될 아이콘 (투명 배경 권장)
        vibrate: [200, 100, 200], // 진동 패턴 (모바일 기기용)
        data: {
          url: data.url || "/", // 알림 클릭 시 이동할 주소 저장
        },
      };
  
      // 브라우저에게 알림을 띄우라고 지시합니다.
      event.waitUntil(self.registration.showNotification(data.title, options));
    } catch (error) {
      console.error("푸시 알림 처리 중 에러:", error);
    }
  });
  
  // 2. 사용자가 뜬 알림창을 클릭했을 때 발생하는 이벤트
  self.addEventListener("notificationclick", function (event) {
    // 알림창을 닫습니다.
    event.notification.close();
  
    const urlToOpen = event.notification.data.url;
  
    // 알림 클릭 시 해당 URL로 이동하거나, 이미 열려있는 탭이 있다면 그 탭을 활성화합니다.
    event.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (windowClients) {
        // 이미 같은 주소의 창이 열려있는지 확인
        for (let i = 0; i < windowClients.length; i++) {
          const client = windowClients[i];
          if (client.url === urlToOpen && "focus" in client) {
            return client.focus();
          }
        }
        // 열려있는 창이 없다면 새 창(또는 앱 화면)을 엽니다.
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
    );
  });