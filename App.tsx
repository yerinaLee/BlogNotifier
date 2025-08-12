import React, {useEffect, useState} from 'react';
import {SafeAreaView, StatusBar, StyleSheet, Text, View, TouchableOpacity} from 'react-native';
import BackgroundFetch from 'react-native-background-fetch';
import PushNotification from 'react-native-push-notification';
import cheerio from 'cheerio';
import moment from 'moment-timezone';
import AsyncStorage from '@react-native-async-storage/async-storage';

// --- 설정 변수 ---
const BLOG_URL = 'https://blog.naver.com/poikl11234';
const NOTIFICATION_CHANNEL_ID = 'blog-notification-channel';

// --- 푸시 알림 초기 설정 ---
PushNotification.configure({
  onRegister: function (token) {
    console.log('TOKEN:', token);
  },
  onNotification: function (notification) {
    console.log('NOTIFICATION:', notification);
  },
  permissions: {
    alert: true,
    badge: true,
    sound: true,
  },
  popInitialNotification: true,
  requestPermissions: true,
});

// --- 알림 채널 생성 (안드로이드 8.0 이상 필수) ---
PushNotification.createChannel(
  {
    channelId: NOTIFICATION_CHANNEL_ID,
    channelName: '블로그 새 글 알림',
    channelDescription: '블로그에 새 글이 올라오면 알려줍니다.',
    playSound: true,
    soundName: 'default',
    vibrate: true,
  },
  created => console.log(`알림 채널 생성 결과: '${created}'`),
);

// --- 로컬 알림 전송 함수 ---
const sendLocalNotification = (title, message) => {
  PushNotification.localNotification({
    channelId: NOTIFICATION_CHANNEL_ID,
    title: title,
    message: message,
    vibrate: true,
    vibration: 300,
    playSound: true,
    soundName: 'default',
  });
};

// --- 블로그 확인 및 알림 로직 ---
const checkBlogForNewPost = async () => {
  console.log('[BlogNotifier] 블로그 확인 작업 시작...');

  // 1. 현재 시간이 조건에 맞는지 확인 (평일, 1~28일, 19시 이후)
  const now = moment().tz('Asia/Seoul');
  const dayOfWeek = now.day(); // 0: 일요일, 1: 월요일, ..., 6: 토요일
  const dayOfMonth = now.date();
  const hour = now.hour();

  // 주말이거나, 28일 이후이거나, 19시 이전이면 작업 종료
  /* if (dayOfWeek === 0 || dayOfWeek === 6) {
    console.log('[BlogNotifier] 주말이므로 작업을 건너뜁니다.');
    return;
  }
  if (dayOfMonth > 28) {
    console.log(`[BlogNotifier] ${dayOfMonth}일이므로 작업을 건너뜁니다.`);
    return;
  }
  if (hour < 19) {
    console.log('[BlogNotifier] 19시 이전이므로 작업을 건너뜁니다.');
    return;
  } */

  // 2. 오늘 날짜로 이미 알림을 보냈는지 확인
  const todayString = now.format('YYYY-MM-DD');
  const notificationStatus = await AsyncStorage.getItem(todayString);

  if (notificationStatus === 'sent_new' || notificationStatus === 'sent_none') {
    console.log(`[BlogNotifier] 오늘(${todayString})은 이미 알림을 보냈습니다.`);
    return;
  }

  try {
    // 3. 블로그 HTML 가져오기
    const response = await fetch(BLOG_URL, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36',
          },
        });
    const html = await response.text();
    const $ = cheerio.load(html);

    // 4. 최신 글 정보 파싱하기
    // 네이버 블로그 구조에 따라 selector는 변경될 수 있습니다.
    // 보통 'se-main-container' 내부의 글 목록을 찾습니다.
    // 이 예제에서는 가장 일반적인 구조를 가정합니다.
    let latestPostTitle = '제목을 찾을 수 없음';
    let latestPostDate = null;

    // 네이버 블로그 PC 웹뷰의 최신 포스트 목록 선택자 (변경될 수 있음)
    const postElement = $('div.se-main-container').first();
    if (postElement.length > 0) {
      // 제목 찾기 (보통 h3 태그)
      latestPostTitle =
        postElement.find('div.se-title-text span').text().trim() ||
        '제목 없음';

      // 날짜 찾기 (보통 'se_publishDate' 클래스)
      const dateText = postElement.find('span.se_publishDate').text().trim();
      // "2024. 7. 30. 19:30" 같은 형식을 파싱
      const parsedDate = moment(dateText, 'YYYY. M. D. HH:mm').tz('Asia/Seoul');
      if (parsedDate.isValid()) {
        latestPostDate = parsedDate;
      }
    } else {
        // 만약 위 선택자로 못찾을 경우, 다른 구조를 시도 (예: 모바일 뷰)
        // 이 부분은 실제 블로그 구조를 보고 맞춰야 합니다.
        console.log('[BlogNotifier] 기본 선택자로 글을 찾지 못했습니다.');
    }


    // 5. 알림 로직 실행
    if (latestPostDate && latestPostDate.isSame(now, 'day')) {
      // 오늘 날짜의 새 글이 있는 경우
      console.log(`[BlogNotifier] 새 글 발견: ${latestPostTitle}`);
      sendLocalNotification(
        '🎉 블로그 새 글 알림',
        `${todayString} / ${latestPostTitle} - 새 글 올라옴`,
      );
      await AsyncStorage.setItem(todayString, 'sent_new');
    } else {
      // 오늘 날짜의 새 글이 없는 경우
      if (hour >= 20) {
        // 20시가 넘었다면 "글 없음" 알림 전송
        console.log('[BlogNotifier] 20시가 넘도록 새 글이 없습니다.');
        sendLocalNotification(
          '😥 블로그 알림',
          '오늘의 새 글이 아직 올라오지 않았습니다.',
        );
        await AsyncStorage.setItem(todayString, 'sent_none');
      } else {
        console.log('[BlogNotifier] 아직 20시 전이고, 새 글이 없습니다.');
      }
    }
  } catch (error) {
    console.error('[BlogNotifier] 블로그 확인 중 오류 발생:', error);
  }
};

const App = () => {
  const [status, setStatus] = useState('대기 중');

  useEffect(() => {
    // --- 백그라운드 Fetch 초기화 ---
    const initBackgroundFetch = async () => {
      const onEvent = async taskId => {
        console.log('[BackgroundFetch] 이벤트 수신:', taskId);
        await checkBlogForNewPost();
        // 작업이 완료되었음을 시스템에 반드시 알려야 합니다.
        BackgroundFetch.finish(taskId);
      };

      const onTimeout = async taskId => {
        console.warn('[BackgroundFetch] 타임아웃:', taskId);
        BackgroundFetch.finish(taskId);
      };

      const status = await BackgroundFetch.configure(
        {
          minimumFetchInterval: 15, // 최소 간격 (분)
          stopOnTerminate: false,
          startOnBoot: true,
          enableHeadless: true,
          requiresBatteryNotLow: true,
          requiresStorageNotLow: true,
        },
        onEvent,
        onTimeout,
      );

      console.log('[BackgroundFetch] 설정 완료, 상태:', status);
      setStatus('백그라운드 작업이 설정되었습니다.');
    };

    initBackgroundFetch();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle={'dark-content'} />
      <View style={styles.content}>
        <Text style={styles.title}>블로그 알림 앱</Text>
        <Text style={styles.text}>
          이 앱은 백그라운드에서 주기적으로{'\n'}
          지정된 네이버 블로그를 확인합니다.
        </Text>
        <Text style={styles.status}>현재 상태: {status}</Text>
        <TouchableOpacity
          style={styles.button}
          onPress={() => {
            console.log('테스트 버튼 클릭! 블로그 확인을 시작합니다.');
            checkBlogForNewPost();
          }}>
          <Text style={styles.buttonText}>수동으로 새 글 확인 (테스트)</Text>
        </TouchableOpacity>
        <Text style={styles.info}>
          - 평일, 매월 1일~28일 사이에만 작동합니다.
          {'\n'}- 19시 이후 새 글이 올라오면 알림을 보냅니다.
          {'\n'}- 20시까지 글이 없으면 없다고 알려줍니다.
        </Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f4f7',
  },
  content: {
    padding: 20,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1a237e',
    marginBottom: 20,
  },
  text: {
    fontSize: 16,
    textAlign: 'center',
    color: '#37474f',
    marginBottom: 30,
    lineHeight: 24,
  },
  status: {
    fontSize: 18,
    fontWeight: '600',
    color: '#00695c',
    marginBottom: 20,
  },
  info: {
    fontSize: 14,
    color: '#546e7a',
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 20,
    paddingHorizontal: 10,
    borderTopWidth: 1,
    borderTopColor: '#cfd8dc',
    paddingTop: 20,
  },
  button: {
      backgroundColor: '#1976d2',
      paddingVertical: 12,
      paddingHorizontal: 25,
      borderRadius: 8,
      marginVertical: 20,
      elevation: 3, // 안드로이드 그림자 효과
    },
    buttonText: {
      color: '#ffffff',
      fontSize: 16,
      fontWeight: 'bold',
    },
});

export default App;
